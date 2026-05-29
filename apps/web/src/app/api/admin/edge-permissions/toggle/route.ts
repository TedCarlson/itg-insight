import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string) {
  return UUID_RE.test(v);
}

/**
 * Canonical "big gates" ONLY.
 * If it isn't one of these, the console cannot toggle it.
 */
const CORE_PERMISSION_KEYS = ["roster_manage", "route_lock_manage", "schedule_exception_submit", "metrics_manage"] as const;
type CorePermissionKey = (typeof CORE_PERMISSION_KEYS)[number];

type Body = {
  scope: "global" | "pc_org";
  pcOrgId?: string | null;

  targetAuthUserId: string;
  permissionKey: string; // validate -> CorePermissionKey
  enabled: boolean;
};

async function isOwner(sb: any) {
  try {
    const { data } = await sb.rpc("is_owner");
    return !!data;
  } catch {
    return false;
  }
}

async function hasAnyRole(admin: any, auth_user_id: string, roleKeys: string[]) {
  const { data, error } = await admin.from("user_roles").select("role_key").eq("auth_user_id", auth_user_id);
  if (error) return false;
  const roles = (data ?? []).map((r: any) => String(r?.role_key ?? "")).filter(Boolean);
  return roles.some((rk: string) => roleKeys.includes(rk));
}

function isCorePermissionKey(k: string): k is CorePermissionKey {
  return (CORE_PERMISSION_KEYS as readonly string[]).includes(k);
}

export async function POST(req: Request) {
  try {
    const sb = await supabaseServer();
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const actorId = userData.user.id;

    // gate: owner OR elevated role
    const owner = await isOwner(sb);
    const elevated = owner || (await hasAnyRole(admin, actorId, ["admin", "dev", "director", "vp"]));
    if (!elevated) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const scope = body.scope;
    const target = String(body.targetAuthUserId ?? "").trim();
    const keyRaw = String(body.permissionKey ?? "").trim();
    const enabled = body.enabled === true;

    if (!target || !isUuid(target)) {
      return NextResponse.json({ ok: false, error: "invalid_target" }, { status: 400 });
    }

    if (!keyRaw) {
      return NextResponse.json({ ok: false, error: "missing_permission_key" }, { status: 400 });
    }

    // HARD LIMIT to core keys
    if (!isCorePermissionKey(keyRaw)) {
      return NextResponse.json(
        { ok: false, error: "permission_key_not_allowed", allowed: CORE_PERMISSION_KEYS },
        { status: 400 }
      );
    }

    const key: CorePermissionKey = keyRaw;

    // Optional: validate key exists in permission_def (helps catch typos / DB drift)
    const keyCheck = await admin.from("permission_def").select("permission_key").eq("permission_key", key).maybeSingle();
    if (keyCheck.error) return NextResponse.json({ ok: false, error: keyCheck.error.message }, { status: 500 });
    if (!keyCheck.data) return NextResponse.json({ ok: false, error: "unknown_permission_key" }, { status: 400 });

    if (scope === "pc_org") {
      const pcOrgId = String(body.pcOrgId ?? "").trim();
      if (!pcOrgId || !isUuid(pcOrgId)) {
        return NextResponse.json({ ok: false, error: "missing_or_invalid_pc_org_id" }, { status: 400 });
      }

      if (enabled) {
        const up = await admin
          .from("pc_org_permission_grant")
          .upsert(
            { pc_org_id: pcOrgId, auth_user_id: target, permission_key: key, created_by: actorId },
            { onConflict: "pc_org_id,auth_user_id,permission_key" }
          );
        if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });

        const aud = await admin.from("pc_org_permission_grant_audit").insert({
          actor_user_id: actorId,
          target_user_id: target,
          pc_org_id: pcOrgId,
          permission_key: key,
          action: "GRANT",
          source: "admin-console",
        });
        if (aud.error) return NextResponse.json({ ok: false, error: aud.error.message }, { status: 500 });
      } else {
        const del = await admin
          .from("pc_org_permission_grant")
          .delete()
          .eq("pc_org_id", pcOrgId)
          .eq("auth_user_id", target)
          .eq("permission_key", key);
        if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });

        const aud = await admin.from("pc_org_permission_grant_audit").insert({
          actor_user_id: actorId,
          target_user_id: target,
          pc_org_id: pcOrgId,
          permission_key: key,
          action: "REVOKE",
          source: "admin-console",
        });
        if (aud.error) return NextResponse.json({ ok: false, error: aud.error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // global scope
    if (enabled) {
      const up = await admin
        .from("admin_permission_grant")
        .upsert({ auth_user_id: target, permission_key: key, created_by: actorId }, { onConflict: "auth_user_id,permission_key" });
      if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });

      const aud = await admin.from("admin_permission_grant_audit").insert({
        actor_user_id: actorId,
        target_user_id: target,
        permission_key: key,
        action: "GRANT",
        source: "admin-console",
      });
      if (aud.error) return NextResponse.json({ ok: false, error: aud.error.message }, { status: 500 });
    } else {
      const del = await admin.from("admin_permission_grant").delete().eq("auth_user_id", target).eq("permission_key", key);
      if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });

      const aud = await admin.from("admin_permission_grant_audit").insert({
        actor_user_id: actorId,
        target_user_id: target,
        permission_key: key,
        action: "REVOKE",
        source: "admin-console",
      });
      if (aud.error) return NextResponse.json({ ok: false, error: aud.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown_error" }, { status: 500 });
  }
}