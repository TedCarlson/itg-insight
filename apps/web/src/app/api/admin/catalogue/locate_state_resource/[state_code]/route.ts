import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function nonnegInt(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ state_code: string }> }
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { state_code } = await context.params;
  const code = String(state_code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return NextResponse.json({ error: "Invalid state_code" }, { status: 400 });
  }

  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if ("state_name" in body) {
    const state_name = String(body.state_name ?? "").trim();
    if (!state_name) return NextResponse.json({ error: "state_name is required" }, { status: 400 });
    patch.state_name = state_name;
  }

  if ("backlog_seed" in body) patch.backlog_seed = nonnegInt(body.backlog_seed);
  if ("default_manpower" in body) patch.default_manpower = nonnegInt(body.default_manpower);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No supported fields to update" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("locate_state_resource")
    .update(patch)
    .eq("state_code", code);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
