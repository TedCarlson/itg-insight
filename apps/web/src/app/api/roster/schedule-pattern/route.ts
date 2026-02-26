// RUN THIS (1/3)
// Create NEW file:
// apps/web/src/app/api/roster/schedule-pattern/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function isoDateOnly(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

async function guardOrgAccess(pc_org_id: string) {
  const sb = await supabaseServer();
  const admin = supabaseAdmin();

  const { data, error: userErr } = await sb.auth.getUser();
  const user = data?.user ?? null;
  if (userErr || !user?.id) {
    return { ok: false as const, status: 401, error: "not_authenticated" };
  }

  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;

  const { data: canAccess, error: accessErr } = await apiClient.rpc("can_access_pc_org", { p_pc_org_id: pc_org_id });
  if (accessErr || !canAccess) {
    return { ok: false as const, status: 403, error: "forbidden" };
  }

  return { ok: true as const, sb, admin, apiClient, auth_user_id: user.id };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const pc_org_id = String(body?.pc_org_id ?? "").trim();
    if (!pc_org_id) {
      return NextResponse.json({ ok: false, error: "Missing pc_org_id" }, { status: 400 });
    }

    const guard = await guardOrgAccess(pc_org_id);
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const today = isoDateOnly(new Date());

    // Find the fiscal month containing today (your 22→21 months are already modeled in fiscal_month_dim)
    const { data: month, error: monthErr } = await guard.admin
      .from("fiscal_month_dim")
      .select("fiscal_month_id, month_key, label, start_date, end_date")
      .lte("start_date", today)
      .gte("end_date", today)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (monthErr) {
      return NextResponse.json({ ok: false, error: monthErr.message }, { status: 500 });
    }
    if (!month?.fiscal_month_id) {
      return NextResponse.json({ ok: false, error: "fiscal_month_dim not found for today", today }, { status: 404 });
    }

    // Pull baseline schedule pattern for the month
    const { data: rows, error: schErr } = await guard.admin
      .from("schedule_baseline_month")
      .select("assignment_id,tech_id,sun,mon,tue,wed,thu,fri,sat")
      .eq("pc_org_id", pc_org_id)
      .eq("fiscal_month_id", month.fiscal_month_id);

    if (schErr) {
      return NextResponse.json({ ok: false, error: schErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      pc_org_id,
      fiscal_month: month,
      rows: rows ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e ?? "error") }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Optional: allow GET with ?pc_org_id=...
  const url = new URL(req.url);
  const pc_org_id = String(url.searchParams.get("pc_org_id") ?? "").trim();
  if (!pc_org_id) {
    return NextResponse.json({ ok: false, error: "Missing pc_org_id" }, { status: 400 });
  }
  return POST(new Request(req.url, { method: "POST", body: JSON.stringify({ pc_org_id }) }));
}