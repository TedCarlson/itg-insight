import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const sb = await supabaseServer();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "no user" }, { status: 401 });
  }

  const { data: profile } = await sb
    .from("user_profile")
    .select("auth_user_id, selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: permissionCheck } = await sb.rpc(
    "has_pc_org_permission",
    {
      p_pc_org_id: profile?.selected_pc_org_id,
      p_permission_key: "metrics_manage",
    }
  );

  const { data: visibleBatches } = await sb
    .from("metric_raw_batches_compat_v")
    .select("batch_id")
    .eq("pc_org_id", profile?.selected_pc_org_id);

  return NextResponse.json({
    auth_uid: user.id,
    selected_pc_org_id: profile?.selected_pc_org_id,
    permission_metrics_manage: permissionCheck,
    visible_batch_count: visibleBatches?.length ?? 0,
  });
}