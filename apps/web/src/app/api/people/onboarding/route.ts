// path: apps/web/src/app/api/people/onboarding/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { loadPeopleOnboardingRows } from "@/shared/server/people/loadPeopleOnboardingRows.server";

export async function GET() {
  const userClient = await supabaseServer();

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await userClient
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const pcOrgId = profile?.selected_pc_org_id ?? null;

  if (!pcOrgId) {
    return NextResponse.json(
      { error: "No selected PC org found" },
      { status: 400 }
    );
  }

  try {
    const rows = await loadPeopleOnboardingRows({
      pc_org_id: pcOrgId,
      limit: 500,
    });

    return NextResponse.json({ rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load onboarding rows";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}