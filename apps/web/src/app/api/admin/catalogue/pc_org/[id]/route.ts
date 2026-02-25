import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type PatchBody = {
  pc_org_name?: string | null;
  fulfillment_center_name?: string | null;
  fulfillment_center_id?: string | number | null;
};

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const body = (await req.json()) as PatchBody;

    // allowlist fields (no drift, no foot-guns)
    const patch: Record<string, unknown> = {};
    if ("pc_org_name" in body) patch.pc_org_name = body.pc_org_name ?? null;
    if ("fulfillment_center_name" in body) patch.fulfillment_center_name = body.fulfillment_center_name ?? null;
    if ("fulfillment_center_id" in body)
      patch.fulfillment_center_id = body.fulfillment_center_id == null ? null : String(body.fulfillment_center_id);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { error } = await admin.from("pc_org").update(patch).eq("pc_org_id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}