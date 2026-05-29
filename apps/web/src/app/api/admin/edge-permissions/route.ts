import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string) {
  return UUID_RE.test(v);
}

function firstEmail(emails: unknown): string | null {
  if (!emails) return null;
  if (Array.isArray(emails)) {
    const hit = emails.find((x) => typeof x === "string" && x.includes("@"));
    return hit ? String(hit).trim() : null;
  }
  if (typeof emails !== "string") return null;

  const s = emails.trim();
  if (!s) return null;

  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      return firstEmail(parsed);
    } catch {
      // fallthrough
    }
  }

  const parts = s
    .split(/[,\s;]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

  return parts.find((p) => p.includes("@")) ?? (parts[0] ?? null);
}

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

/**
 * Canonical "big gates" for the app.
 * Everything else is future-only and should NOT show up as a column in the console yet.
 */
const CORE_PERMISSION_KEYS = ["roster_manage", "route_lock_manage", "schedule_exception_submit", "metrics_manage"] as const;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const q = (url.searchParams.get("q") ?? "").trim();
    const scope = (url.searchParams.get("scope") ?? "global").trim(); // "global" | "pc_org"
    const pc_org_id = (url.searchParams.get("pc_org_id") ?? "").trim();

    const pageIndex = Math.max(0, Number(url.searchParams.get("pageIndex") ?? 0) || 0);
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? 25) || 25));

    // auth via cookies
    const sb = await supabaseServer();
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // gate: owner OR elevated role
    const admin = supabaseAdmin();
    const uid = userData.user.id;

    const owner = await isOwner(sb);
    const elevated = owner || (await hasAnyRole(admin, uid, ["admin", "dev", "director", "vp"]));
    if (!elevated) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (scope === "pc_org") {
      if (!pc_org_id || !isUuid(pc_org_id)) {
        return NextResponse.json({ ok: false, error: "missing_or_invalid_pc_org_id" }, { status: 400 });
      }
    }

    // Permission keys (columns) — HARD LIMITED TO CORE KEYS
    const permsRes = await admin
      .from("permission_def")
      .select("permission_key")
      .in("permission_key", [...CORE_PERMISSION_KEYS]);

    if (permsRes.error) {
      return NextResponse.json({ ok: false, error: permsRes.error.message }, { status: 500 });
    }

    const present = new Set(
      (permsRes.data ?? [])
        .map((r: any) => String(r.permission_key))
        .filter(Boolean)
    );

    // Keep canonical ordering
    const permissionKeys = CORE_PERMISSION_KEYS.filter((k) => present.has(k));

    // pc org options for delegation mode
    const pcOrgsRes = await admin
      .from("pc_org")
      .select("pc_org_id, pc_org_name")
      .order("pc_org_name", { ascending: true })
      .limit(5000);

    if (pcOrgsRes.error) {
      return NextResponse.json({ ok: false, error: pcOrgsRes.error.message }, { status: 500 });
    }

    const pcOrgs = (pcOrgsRes.data ?? []).map((r: any) => ({
      pc_org_id: String(r.pc_org_id),
      pc_org_name: String(r.pc_org_name ?? ""),
    }));

    // USERS: start from user_profile
    const from = pageIndex * pageSize;
    const to = from + pageSize - 1;

    const profilesRes = await admin
      .from("user_profile")
      .select("auth_user_id, person_id, status")
      .not("auth_user_id", "is", null)
      .range(from, to);

    if (profilesRes.error) {
      return NextResponse.json({ ok: false, error: profilesRes.error.message }, { status: 500 });
    }

    const profiles = (profilesRes.data ?? [])
      .map((r: any) => ({
        auth_user_id: String(r.auth_user_id ?? "").trim(),
        person_id: r.person_id ? String(r.person_id).trim() : null,
        status: r.status ? String(r.status) : null,
      }))
      .filter((r) => r.auth_user_id);

    const personIds = profiles.map((p) => p.person_id).filter(Boolean) as string[];

    // person display
    const personById = new Map<string, { full_name: string | null; email: string | null; role: string | null }>();
    if (personIds.length) {
      const peopleRes = await admin
        .from("person")
        .select("person_id, full_name, emails, role")
        .in("person_id", personIds.slice(0, 2000));

      if (peopleRes.error) {
        return NextResponse.json({ ok: false, error: peopleRes.error.message }, { status: 500 });
      }

      for (const p of peopleRes.data ?? []) {
        const id = String((p as any).person_id ?? "").trim();
        if (!id) continue;
        personById.set(id, {
          full_name: (p as any).full_name ?? null,
          email: firstEmail((p as any).emails),
          role: (p as any).role ?? null,
        });
      }
    }

    // map to user objects
    let users = profiles.map((pr) => {
      const person = pr.person_id ? personById.get(pr.person_id) : undefined;
      return {
        auth_user_id: pr.auth_user_id,
        full_name: person?.full_name ?? null,
        email: person?.email ?? null,
        status: pr.status ?? null,
        role: person?.role ?? null,
      };
    });

    // search filter
    if (q) {
      const qq = q.toLowerCase();
      users = users.filter((u) => {
        const a = (u.full_name ?? "").toLowerCase();
        const b = (u.email ?? "").toLowerCase();
        return a.includes(qq) || b.includes(qq) || u.auth_user_id.toLowerCase().includes(qq);
      });
    }

    // employee-only default: exclude Contractors when role is known
    users = users.filter((u) => (u.role ? u.role !== "Contractors" : true));

    // grants for this page slice
    const grants = new Map<string, Set<string>>();

    if (users.length) {
      if (scope === "pc_org") {
        const res = await admin
          .from("pc_org_permission_grant")
          .select("auth_user_id, permission_key")
          .eq("pc_org_id", pc_org_id)
          .in("auth_user_id", users.map((u) => u.auth_user_id))
          .in("permission_key", permissionKeys);

        if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });

        for (const r of res.data ?? []) {
          const uid2 = String((r as any).auth_user_id ?? "").trim();
          const pk = String((r as any).permission_key ?? "").trim();
          if (!uid2 || !pk) continue;
          const set = grants.get(uid2) ?? new Set<string>();
          set.add(pk);
          grants.set(uid2, set);
        }
      } else {
        const res = await admin
          .from("admin_permission_grant")
          .select("auth_user_id, permission_key")
          .in("auth_user_id", users.map((u) => u.auth_user_id))
          .in("permission_key", permissionKeys);

        if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });

        for (const r of res.data ?? []) {
          const uid2 = String((r as any).auth_user_id ?? "").trim();
          const pk = String((r as any).permission_key ?? "").trim();
          if (!uid2 || !pk) continue;
          const set = grants.get(uid2) ?? new Set<string>();
          set.add(pk);
          grants.set(uid2, set);
        }
      }
    }

    const rows = users.map((u) => {
      const set = grants.get(u.auth_user_id) ?? new Set<string>();
      const grantMap: Record<string, boolean> = {};
      for (const key of permissionKeys) grantMap[key] = set.has(key);

      return {
        user: {
          authUserId: u.auth_user_id,
          email: u.email,
          fullName: u.full_name,
          status: u.status,
          isEmployee: u.role ? u.role !== "Contractors" : null,
        },
        grants: grantMap,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        permissionKeys,
        rows,
        page: { pageIndex, pageSize },
        pcOrgs,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown_error" }, { status: 500 });
  }
}