// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/route-lock/schedule/upsert/route.ts

import { NextResponse } from "next/server";

import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function asUuid(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return null;
  return s;
}

function asText(v: unknown): string {
  return String(v ?? "").trim();
}

function asBool(v: unknown): boolean {
  return !!v;
}

async function guardSelectedOrgRouteLockManage() {
  const sb = await supabaseServer();
  const admin = supabaseAdmin();

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) return { ok: false as const, status: 401, error: "unauthorized" };

  const { data: profile, error: profErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profErr) return { ok: false as const, status: 500, error: profErr.message };

  const pc_org_id = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pc_org_id) return { ok: false as const, status: 409, error: "no selected org" };

  // owner is always allowed
  const { data: isOwner, error: ownerErr } = await sb.rpc("is_owner");
  if (ownerErr) return { ok: false as const, status: 403, error: "forbidden" };
  if (isOwner) return { ok: true as const, pc_org_id, auth_user_id: user.id };

  // permission gate (route_lock_manage preferred; roster_manage allowed)
  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;
  const { data: allowed, error: permErr } = await apiClient.rpc("has_any_pc_org_permission", {
    p_pc_org_id: pc_org_id,
    p_permission_keys: ["route_lock_manage", "roster_manage"],
  });

  if (permErr || !allowed) return { ok: false as const, status: 403, error: "forbidden" };

  return { ok: true as const, pc_org_id, auth_user_id: user.id };
}

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export async function POST(req: Request) {
  try {
    const guard = await guardSelectedOrgRouteLockManage();
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

    const body = await req.json().catch(() => null);

    const fiscal_month_id = asUuid(body?.fiscal_month_id);
    if (!fiscal_month_id) {
      return NextResponse.json({ ok: false, error: "Missing/invalid fiscal_month_id (UUID)" }, { status: 400 });
    }

    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, updated: 0, sweep: null });
    }

    // Normalize upserts
    const upsertRows = rows
      .map((r: any) => {
        const assignment_id = asUuid(r?.assignment_id);
        const tech_id = asText(r?.tech_id);
        const default_route_id = asUuid(r?.default_route_id) ?? null;
        const days: Record<DayKey, boolean> = r?.days ?? {};

        if (!tech_id) return null; // tech_id is the business key
        // assignment_id is allowed to be null for some flows, but you currently pass it.
        // Keep it nullable-safe for safety.
        return {
          pc_org_id: guard.pc_org_id,
          fiscal_month_id,
          tech_id,
          assignment_id: assignment_id ?? null,
          default_route_id,
          sun: asBool(days.sun),
          mon: asBool(days.mon),
          tue: asBool(days.tue),
          wed: asBool(days.wed),
          thu: asBool(days.thu),
          fri: asBool(days.fri),
          sat: asBool(days.sat),
          is_active: true,
          updated_by: guard.auth_user_id,
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean) as any[];

    if (upsertRows.length === 0) {
      return NextResponse.json({ ok: false, error: "No valid rows (tech_id required)" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // IMPORTANT:
    // schedule_baseline_month has UNIQUE (pc_org_id, fiscal_month_id, tech_id)
    const { data: up, error: upErr } = await admin
      .from("schedule_baseline_month")
      .upsert(upsertRows, { onConflict: "pc_org_id,fiscal_month_id,tech_id" })
      .select("schedule_baseline_month_id,tech_id");

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    // Sweep month after baseline upsert so day_facts reflect changes
    const { data: sweep, error: sweepErr } = await admin.rpc("schedule_sweep_month", {
      p_pc_org_id: guard.pc_org_id,
      p_fiscal_month_id: fiscal_month_id,
    });

    if (sweepErr) return NextResponse.json({ ok: false, error: sweepErr.message }, { status: 500 });

    // Supabase doesn’t reliably return inserted vs updated counts; keep it simple
    return NextResponse.json({
      ok: true,
      baseline_upserted: Array.isArray(up) ? up.length : 0,
      sweep,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "unknown error") }, { status: 500 });
  }
}