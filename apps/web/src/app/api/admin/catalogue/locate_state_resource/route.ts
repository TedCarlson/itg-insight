import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function nonnegInt(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const pageIndex = Math.max(0, num(url.searchParams.get("pageIndex"), 0));
  const pageSize = Math.min(100, Math.max(5, num(url.searchParams.get("pageSize"), 25)));
  const from = pageIndex * pageSize;
  const to = from + pageSize - 1;

  const admin = supabaseAdmin();

  let query = admin
    .from("locate_state_resource")
    .select("state_code,state_name,backlog_seed,default_manpower", { count: "exact" })
    .order("state_code", { ascending: true })
    .range(from, to);

  if (q) {
    query = query.or(`state_code.ilike.%${q}%,state_name.ilike.%${q}%`);
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const state_code = String(body.state_code ?? "").trim().toUpperCase();
  const state_name = String(body.state_name ?? "").trim();

  if (!/^[A-Z]{2}$/.test(state_code)) {
    return NextResponse.json({ error: "state_code must be a 2-letter code" }, { status: 400 });
  }

  if (!state_name) {
    return NextResponse.json({ error: "state_name is required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from("locate_state_resource").insert({
    state_code,
    state_name,
    backlog_seed: nonnegInt(body.backlog_seed),
    default_manpower: nonnegInt(body.default_manpower),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: state_code });
}
