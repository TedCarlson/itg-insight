// apps/web/src/app/api/roster/invite/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type GuardOk = { ok: true; pc_org_id: string; auth_user_id: string; apiClient: any };
type GuardFail = { ok: false; status: number; error: string; debug?: any };

function debugEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ROSTER_DEBUG === "1";
}
function dbg<T>(value: T): T | null {
  return debugEnabled() ? value : null;
}

async function hasAnyRole(admin: any, auth_user_id: string, roleKeys: string[]): Promise<boolean> {
  const { data, error } = await admin.from("user_roles").select("role_key").eq("auth_user_id", auth_user_id);
  if (error) return false;
  const roles = (data ?? []).map((r: { role_key?: unknown }) => String(r?.role_key ?? ""));
  return roles.some((rk: string) => roleKeys.includes(rk));
}

/**
 * Guard for Roster Invite Status.
 * - Must be signed in
 * - Must have selected pc_org_id
 * - Must pass baseline org access (can_access_pc_org)
 * - Then allow if owner OR elevated role OR roster_manage grant (via boolean RPC)
 */
async function guardSelectedOrgRosterManage(): Promise<GuardOk | GuardFail> {
  const sb = await supabaseServer();
  const admin = supabaseAdmin();

  const { data, error: userErr } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (userErr || !user?.id) {
    return { ok: false, status: 401, error: "not_authenticated", debug: dbg({ step: "no_user", userErr }) };
  }
  const userId = user.id;

  const { data: profile, error: profErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (profErr) {
    return { ok: false, status: 500, error: profErr.message, debug: dbg({ step: "profile_read_error", profErr }) };
  }

  const pc_org_id = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pc_org_id) {
    return { ok: false, status: 409, error: "no_selected_pc_org", debug: dbg({ step: "no_selected_org" }) };
  }

  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;

  // Baseline org access (eligibility/grants/derived leadership via DB)
  const { data: canAccess, error: accessErr } = await apiClient.rpc("can_access_pc_org", { p_pc_org_id: pc_org_id });
  if (accessErr || !canAccess) {
    return {
      ok: false,
      status: 403,
      error: "forbidden",
      debug: dbg({ step: "baseline_access_rpc", accessErr, canAccess }),
    };
  }

  // Owner bypass
  const { data: ownerRow, error: ownerErr } = await admin
    .from("app_owners")
    .select("auth_user_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (ownerErr) {
    return { ok: false, status: 500, error: ownerErr.message, debug: dbg({ step: "owner_check_error", ownerErr }) };
  }
  if (ownerRow?.auth_user_id) return { ok: true, pc_org_id, auth_user_id: userId, apiClient };

  // Role bypass
  const roleAllowed = await hasAnyRole(admin, userId, ["admin", "dev", "director", "manager", "vp"]);
  if (roleAllowed) return { ok: true, pc_org_id, auth_user_id: userId, apiClient };

  // roster_manage grant via boolean RPC
  const { data: allowedByGrant, error: grantErr } = await apiClient.rpc("has_any_pc_org_permission", {
    p_pc_org_id: pc_org_id,
    p_permission_keys: ["roster_manage"],
  });

  if (grantErr) {
    return { ok: false, status: 403, error: "forbidden", debug: dbg({ step: "grant_rpc_error", grantErr }) };
  }
  if (!allowedByGrant) {
    return { ok: false, status: 403, error: "forbidden", debug: dbg({ step: "no_matching_grant" }) };
  }

  return { ok: true, pc_org_id, auth_user_id: userId, apiClient };
}

function readKey(req: NextRequest, key: string) {
  const url = new URL(req.url);
  return String(url.searchParams.get(key) ?? "").trim() || null;
}

async function handler(req: NextRequest) {
  const guard = await guardSelectedOrgRosterManage();
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error, debug: dbg(guard.debug ?? null) },
      { status: guard.status },
    );
  }

  const assignment_id = readKey(req, "assignment_id");
  const person_id = readKey(req, "person_id");
  const email = readKey(req, "email");

  if (!assignment_id && !person_id && !email) {
    return NextResponse.json(
      { ok: false, error: "missing_identifier", hint: "Provide assignment_id or person_id or email." },
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();

  // 1) Invite status from roster_invite_log (latest row)
  let inviteQuery = admin
    .from("roster_invite_log")
    .select(
      "invite_id, pc_org_id, person_id, assignment_id, email, invited_by_auth_user_id, invited_at, resend_count",
    )
    .eq("pc_org_id", guard.pc_org_id)
    .order("invited_at", { ascending: false })
    .limit(1);

  if (assignment_id) inviteQuery = inviteQuery.eq("assignment_id", assignment_id);
  else if (person_id) inviteQuery = inviteQuery.eq("person_id", person_id);
  else if (email) inviteQuery = inviteQuery.eq("email", email);

  const { data: inviteRow, error: inviteErr } = await inviteQuery.maybeSingle();
  if (inviteErr) {
    return NextResponse.json(
      { ok: false, error: inviteErr.message, debug: dbg({ step: "invite_log_read_error", inviteErr }) },
      { status: 500 },
    );
  }

  const invited = Boolean(inviteRow?.invite_id);
  const invited_at = inviteRow?.invited_at ? String(inviteRow.invited_at) : null;
  const resolvedPersonId = String(inviteRow?.person_id ?? person_id ?? "").trim() || null;

  // 2) user_profile existence (by person_id)
  let has_profile_row = false;
  let auth_user_id: string | null = null;

  if (resolvedPersonId) {
    const { data: prof, error: profErr } = await admin
      .from("user_profile")
      .select("auth_user_id, person_id")
      .eq("person_id", resolvedPersonId)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json(
        { ok: false, error: profErr.message, debug: dbg({ step: "user_profile_lookup_error", profErr }) },
        { status: 500 },
      );
    }

    has_profile_row = Boolean(prof?.person_id);
    auth_user_id = prof?.auth_user_id ? String(prof.auth_user_id).trim() : null;
  }

  // 3) Auth status
  let last_sign_in_at: string | null = null;
  let auth_email: string | null = null;
  let has_logged_in = false;

  if (auth_user_id) {
    try {
      const { data: authData, error: authErr } = await admin.auth.admin.getUserById(auth_user_id);

      if (!authErr) {
        auth_email = authData?.user?.email ? String(authData.user.email) : null;
        last_sign_in_at = authData?.user?.last_sign_in_at ? String(authData.user.last_sign_in_at) : null;
        has_logged_in = Boolean(last_sign_in_at);
      }
    } catch {
      // keep null/defaults
    }
  }

  return NextResponse.json({
    ok: true,
    invited,
    invited_at,
    has_profile_row,
    auth_user_id,
    has_logged_in,
    last_sign_in_at,
    auth_email,
    debug: dbg({
      pc_org_id: guard.pc_org_id,
      requested: { assignment_id, person_id, email },
      resolved_person_id: resolvedPersonId,
      checked_auth_user_id: auth_user_id,
    }),
  });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}