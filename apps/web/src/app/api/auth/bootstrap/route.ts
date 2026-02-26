import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { bootstrapProfileServer } from "@/shared/lib/auth/bootstrapProfile.server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1️⃣ Bootstrap / hydrate profile
  const profile = await bootstrapProfileServer();

  let accessPass: any = null;

  // 2️⃣ If org selected, issue access pass
  if (profile?.selected_pc_org_id) {
    const { data, error } = await supabase.rpc("get_access_pass", {
      p_pc_org_id: profile.selected_pc_org_id,
    });

    if (!error) {
      accessPass = data;
    }
  }

  return NextResponse.json({
    profile,
    access_pass: accessPass,
  });
}