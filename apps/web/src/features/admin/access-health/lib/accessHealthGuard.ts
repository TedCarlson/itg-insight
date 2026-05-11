// path: apps/web/src/features/admin/access-health/lib/accessHealthGuard.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

export async function requireAccessHealthAdmin() {
  const userClient = await supabaseServer();
  const admin = supabaseAdmin();

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await admin
    .from("user_profile")
    .select("is_admin")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: appOwner } = await admin
    .from("app_owners")
    .select("auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profile?.is_admin === true || appOwner?.auth_user_id) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  };
}