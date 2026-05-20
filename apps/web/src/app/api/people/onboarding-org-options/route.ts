// path: apps/web/src/app/api/people/onboarding-org-options/route.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

export async function GET() {
  const userClient = await supabaseServer();
  const adminClient = await supabaseAdmin();

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await adminClient.rpc(
    "people_onboarding_org_options",
    {
      p_auth_user_id: user.id,
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: data ?? [],
  });
}
