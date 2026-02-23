// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/route-lock/quota/upsert/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type QuotaUpsertRow = {
  quota_id?: string;
  route_id: string;
  fiscal_month_id: string;
  qh_sun: number;
  qh_mon: number;
  qh_tue: number;
  qh_wed: number;
  qh_thu: number;
  qh_fri: number;
  qh_sat: number;
};

type GuardOk = {
  ok: true;
  pc_org_id: string;
  auth_user_id: string;
};

type GuardFail = {
  ok: false;
  status: number;
  error: string;
};

function asUuid(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return null;
  return s;
}

function int0(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

async function hasAnyRole(admin: any, auth_user_id: string, roleKeys: string[]): Promise<boolean> {
  const { data, error } = await admin.from("user_roles").select("role_key").eq("auth_user_id", auth_user_id);
  if (error) return false;
  const roles: string[] = (data ?? []).map((r: { role_key?: unknown }) => String(r?.role_key ?? ""));
  return roles.some((rk: string) => roleKeys.includes(rk));
}

/**
 * Guard for Quota WRITE operations.
 * Must be scoped to selected_pc_org_id and allow:
 * - owner
 * - ITG leadership roles (admin/dev/director/manager/vp)
 * - explicit org-scoped grants: route_lock_manage (preferred) OR roster_manage (legacy compatibility)
 *
 * Always requires baseline org access via api.can_access_pc_org(selected_org).
 */
async function guardSelectedOrgQuotaWrite(): Promise<GuardOk | GuardFail> {
  const sb = await supabaseServer();
  const admin = supabaseAdmin();

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (userErr || !user?.id) return { ok: false, status: 401, error: "unauthorized" };
  const userId = user.id;

  // Read selected org using service role (bypass RLS on user_profile)
  const { data: profile, error: profErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id,status")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (profErr) return { ok: false, status: 500, error: profErr.message };

  const pc_org_id = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pc_org_id) return { ok: false, status: 409, error: "no selected org" };

  // ✅ Baseline org scope (session-aware)
  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;
  const { data: canAccess, error: accessErr } = await apiClient.rpc("can_access_pc_org", { p_pc_org_id: pc_org_id });

  if (accessErr || !canAccess) return { ok: false, status: 403, error: "forbidden" };

  // ✅ Owner bypass
  const { data: ownerRow, error: ownerErr } = await admin
    .from("app_owners")
    .select("auth_user_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (ownerErr) return { ok: false, status: 500, error: ownerErr.message };
  if (ownerRow?.auth_user_id) return { ok: true, pc_org_id, auth_user_id: userId };

  // ✅ Role bypass (ITG management roles)
  const roleAllowed = await hasAnyRole(admin, userId, ["admin", "dev", "director", "manager", "vp"]);
  if (roleAllowed) return { ok: true, pc_org_id, auth_user_id: userId };

  // ✅ Grants check (SERVICE ROLE read; correct schema + correct column names)
  const { data: grants, error: grantErr } = await admin
    .from("pc_org_permission_grant")
    .select("permission_key, expires_at, revoked_at")
    .eq("pc_org_id", pc_org_id)
    .eq("auth_user_id", userId)
    .is("revoked_at", null)
    .in("permission_key", ["route_lock_manage", "roster_manage"]);

  if (grantErr) return { ok: false, status: 500, error: grantErr.message };

  const nowIso = new Date().toISOString();
  const allowed = (grants ?? []).some((g: { expires_at?: unknown }) => {
    const exp = g?.expires_at ? String(g.expires_at) : "";
    return !exp || exp > nowIso;
  });

  if (!allowed) return { ok: false, status: 403, error: "forbidden" };

  return { ok: true, pc_org_id, auth_user_id: userId };
}

export async function POST(req: Request) {
  try {
    const guard = await guardSelectedOrgQuotaWrite();
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

    const body = (await req.json().catch(() => null)) as any;
    const rows = (body?.rows ?? []) as QuotaUpsertRow[];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "no_rows" }, { status: 400 });
    }

    // Normalize + validate
    const clean = rows
      .map((r) => ({
        quota_id: asUuid(r?.quota_id) ?? undefined,
        route_id: asUuid(r?.route_id),
        fiscal_month_id: asUuid(r?.fiscal_month_id),
        qh_sun: int0(r?.qh_sun),
        qh_mon: int0(r?.qh_mon),
        qh_tue: int0(r?.qh_tue),
        qh_wed: int0(r?.qh_wed),
        qh_thu: int0(r?.qh_thu),
        qh_fri: int0(r?.qh_fri),
        qh_sat: int0(r?.qh_sat),
      }))
      .filter((r) => r.route_id && r.fiscal_month_id) as Array<{
      quota_id?: string;
      route_id: string;
      fiscal_month_id: string;
      qh_sun: number;
      qh_mon: number;
      qh_tue: number;
      qh_wed: number;
      qh_thu: number;
      qh_fri: number;
      qh_sat: number;
    }>;

    if (clean.length === 0) {
      return NextResponse.json({ ok: false, error: "invalid_rows" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const results: Array<{ ok: boolean; route_id: string; fiscal_month_id: string; quota_id?: string; error?: string }> =
      [];

    for (const r of clean) {
      const { data: found, error: findErr } = await admin
        .from("quota")
        .select("quota_id")
        .eq("pc_org_id", guard.pc_org_id)
        .eq("route_id", r.route_id)
        .eq("fiscal_month_id", r.fiscal_month_id)
        .maybeSingle();

      if (findErr) {
        results.push({ ok: false, route_id: r.route_id, fiscal_month_id: r.fiscal_month_id, error: findErr.message });
        continue;
      }

      const quota_id = (found?.quota_id ? String(found.quota_id) : r.quota_id) ?? null;

      const payload = {
        quota_id: quota_id ?? undefined,
        pc_org_id: guard.pc_org_id,
        route_id: r.route_id,
        fiscal_month_id: r.fiscal_month_id,
        qh_sun: r.qh_sun,
        qh_mon: r.qh_mon,
        qh_tue: r.qh_tue,
        qh_wed: r.qh_wed,
        qh_thu: r.qh_thu,
        qh_fri: r.qh_fri,
        qh_sat: r.qh_sat,
      };

      const { data: up, error: upErr } = await admin.from("quota").upsert(payload).select("quota_id").maybeSingle();

      if (upErr) {
        results.push({ ok: false, route_id: r.route_id, fiscal_month_id: r.fiscal_month_id, error: upErr.message });
        continue;
      }

      results.push({
        ok: true,
        route_id: r.route_id,
        fiscal_month_id: r.fiscal_month_id,
        quota_id: up?.quota_id ? String(up.quota_id) : quota_id ?? undefined,
      });
    }

    const okCount = results.filter((r) => r.ok).length;
    const allOk = okCount === results.length;

    // ✅ New rule: any sweep runs ALL sweeps (per fiscal month touched)
    const fiscalMonthsTouched = Array.from(new Set(clean.map((r) => r.fiscal_month_id)));
    const sweeps: Record<string, any> = {};

    for (const fmId of fiscalMonthsTouched) {
      const { data: sweepRes, error: sweepErr } = await admin.rpc("route_lock_sweep_month", {
        p_pc_org_id: guard.pc_org_id,
        p_fiscal_month_id: fmId,
      });

      if (sweepErr) {
        return NextResponse.json(
          {
            ok: false,
            error: `quota saved but sweep failed for fiscal_month_id=${fmId}: ${sweepErr.message}`,
            results,
          },
          { status: 500 }
        );
      }

      sweeps[fmId] = sweepRes ?? null;
    }

    return NextResponse.json({
      ok: allOk,
      results,
      sweeps,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}