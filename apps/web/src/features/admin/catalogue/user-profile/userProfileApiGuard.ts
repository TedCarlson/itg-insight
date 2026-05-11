// path: apps/web/src/features/admin/catalogue/user-profile/userProfileApiGuard.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

export async function requireOwnerOrAdmin() {
  const sb = await supabaseServer();

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) {
    return {
      ok: false as const,
      status: 401 as const,
      error: "unauthorized" as const,
      user: null,
    };
  }

  let owner = false;
  let admin = false;

  try {
    const [{ data: isOwner }, { data: isAdmin }] = await Promise.all([
      sb.rpc("is_owner"),
      sb.rpc("is_admin"),
    ]);

    owner = isOwner === true;
    admin = isAdmin === true;
  } catch {
    // keep fallbacks below
  }

  if (!owner && !admin) {
    try {
      const svc = supabaseAdmin();

      const grant = await svc
        .from("admin_permission_grant")
        .select("auth_user_id")
        .eq("auth_user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (grant.data?.auth_user_id) admin = true;
    } catch {
      // ignore and fall through
    }
  }

  if (!owner && !admin) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "forbidden" as const,
      user: null,
    };
  }

  return { ok: true as const, status: 200 as const, error: null, user };
}