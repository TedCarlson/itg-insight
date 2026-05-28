import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function boolish(v: unknown, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(s)) return true;
    if (["false", "0", "no", "n", "off"].includes(s)) return false;
  }
  return fallback;
}

function statusish(v: unknown) {
  return String(v ?? "active").trim().toLowerCase() === "inactive" ? "inactive" : "active";
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const pageIndex = Math.max(0, num(url.searchParams.get("pageIndex"), 0));
  const pageSize = Math.min(100, Math.max(5, num(url.searchParams.get("pageSize"), 25)));
  const from = pageIndex * pageSize;
  const to = from + pageSize - 1;

  const admin = supabaseAdmin();

  let query = admin
    .from("pc_org_state_coverage_admin_v")
    .select("*", { count: "exact" })
    .order("pc_org_name", { ascending: true })
    .order("state_code", { ascending: true })
    .range(from, to);

  if (q) {
    query = query.or(
      `pc_org_name.ilike.%${q}%,mso_name.ilike.%${q}%,state_code.ilike.%${q}%,state_name.ilike.%${q}%`
    );
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    rows: data ?? [],
    page: { pageIndex, pageSize, totalRows: count ?? undefined },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      pc_org_id?: unknown;
      state_code?: unknown;
      is_primary?: unknown;
      coverage_status?: unknown;
    };

    const pc_org_id = body.pc_org_id == null ? "" : String(body.pc_org_id).trim();
    const state_code = body.state_code == null ? "" : String(body.state_code).trim().toUpperCase();

    if (!pc_org_id) return NextResponse.json({ error: "pc_org_id is required" }, { status: 400 });
    if (!state_code) return NextResponse.json({ error: "state_code is required" }, { status: 400 });

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("pc_org_state_coverage")
      .insert({
        pc_org_id,
        state_code,
        is_primary: boolish(body.is_primary, false),
        coverage_status: statusish(body.coverage_status),
      })
      .select("pc_org_state_coverage_id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: data?.pc_org_state_coverage_id ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
