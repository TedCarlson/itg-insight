import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

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

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const body = (await req.json()) as {
      pc_org_id?: unknown;
      state_code?: unknown;
      is_primary?: unknown;
      coverage_status?: unknown;
    };

    const patch: Record<string, unknown> = {};

    if (body.pc_org_id != null) patch.pc_org_id = String(body.pc_org_id).trim() || null;
    if (body.state_code != null) patch.state_code = String(body.state_code).trim().toUpperCase() || null;
    if (body.is_primary != null) patch.is_primary = boolish(body.is_primary, false);
    if (body.coverage_status != null) patch.coverage_status = statusish(body.coverage_status);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No supported fields to update" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { error } = await admin
      .from("pc_org_state_coverage")
      .update(patch)
      .eq("pc_org_state_coverage_id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
