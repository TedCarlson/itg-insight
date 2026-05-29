// apps/web/src/app/api/route-lock/quota/lookups/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type GuardOk = { ok: true; pc_org_id: string; auth_user_id: string; apiClient: any };
type GuardFail = { ok: false; status: number; error: string; debug?: any };

/**
 * Debug gating:
 * - In production: only emit debug when QUOTA_DEBUG=1
 * - In dev/test: debug is allowed by default
 *
 * This is intentionally "read-only" (no behavior impact on auth decisions).
 */
function debugEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.QUOTA_DEBUG === "1";
}

function dbg<T>(value: T): T | null {
  return debugEnabled() ? value : null;
}

function isoDateOnly(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

/**
 * Guard for Quota Lookups (routes + fiscal months).
 *
 * Key principle (manager-centric + stable UI):
 * - Lookups are READ dependencies for UI dropdowns.
 * - They must require only baseline org access (can_access_pc_org).
 * - Do NOT require manage permissions here (those belong on write endpoints).
 */
async function guardSelectedOrgLookupAccess(): Promise<GuardOk | GuardFail> {
  const sb = await supabaseServer();
  const admin = supabaseAdmin();

  const { data, error: userErr } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (userErr || !user?.id) {
    return { ok: false, status: 401, error: "not_authenticated", debug: dbg({ step: "no_user", userErr }) };
  }
  const userId = user.id;

  // Selected org via service role (avoid user_profile RLS surprises)
  const { data: profile, error: profErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id,status")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (profErr) {
    return { ok: false, status: 500, error: profErr.message, debug: dbg({ step: "profile_read_error", profErr }) };
  }

  const pc_org_id = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pc_org_id) {
    return { ok: false, status: 409, error: "no_selected_pc_org", debug: dbg({ step: "no_selected_org" }) };
  }

  // Session-aware API client
  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;

  // Baseline org access (eligibility/grants/derived leadership/owners via DB)
  const { data: canAccess, error: accessErr } = await apiClient.rpc("can_access_pc_org", { p_pc_org_id: pc_org_id });
  if (accessErr || !canAccess) {
    return {
      ok: false,
      status: 403,
      error: "forbidden",
      debug: dbg({ step: "baseline_access_rpc", accessErr, canAccess }),
    };
  }

  return { ok: true, pc_org_id, auth_user_id: userId, apiClient };
}

async function handler() {
  const guard = await guardSelectedOrgLookupAccess();
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error, debug: dbg(guard.debug ?? null) },
      { status: guard.status }
    );
  }

  const admin = supabaseAdmin();

  const today = new Date();
  const startDefault = new Date(today);
  startDefault.setDate(startDefault.getDate() - 92);

  const endDefault = new Date(today);
  endDefault.setDate(endDefault.getDate() + 70);

  // If org has fewer than ~3 months of history, start at oldest record’s month start.
  const { data: oldestRow } = await admin
    .from("quota_admin_v")
    .select("fiscal_month_start_date")
    .eq("pc_org_id", guard.pc_org_id)
    .order("fiscal_month_start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const oldestStart = oldestRow?.fiscal_month_start_date ? new Date(oldestRow.fiscal_month_start_date) : null;
  const windowStart = oldestStart && oldestStart > startDefault ? oldestStart : startDefault;

  const windowStartISO = isoDateOnly(windowStart);
  const windowEndISO = isoDateOnly(endDefault);

  // NOTE: These are lookups. They should succeed for anyone with baseline PC access.
  const { data: routes, error: routesErr } = await admin
    .from("route_admin_v")
    .select("route_id, route_name")
    .eq("pc_org_id", guard.pc_org_id)
    .order("route_name", { ascending: true });

  if (routesErr) {
    return NextResponse.json({ ok: false, error: routesErr.message, debug: dbg({ step: "routes_read_error", routesErr }) }, { status: 500 });
  }

  const { data: months, error: monthsErr } = await admin
    .from("fiscal_month_dim")
    .select("fiscal_month_id, month_key, label, start_date, end_date")
    .gte("start_date", windowStartISO)
    .lte("start_date", windowEndISO)
    .order("start_date", { ascending: false });

  if (monthsErr) {
    return NextResponse.json({ ok: false, error: monthsErr.message, debug: dbg({ step: "months_read_error", monthsErr }) }, { status: 500 });
  }

  const { data: canWriteQuota, error: writeAccessErr } = await guard.apiClient.rpc("has_any_pc_org_permission", {
    p_pc_org_id: guard.pc_org_id,
    p_permission_keys: ["route_lock_manage"],
  });

  return NextResponse.json({
    ok: true,
    routes: routes ?? [],
    months: months ?? [],
    access: {
      can_write_quota: !writeAccessErr && canWriteQuota === true,
    },
    debug: dbg({
      selected_pc_org_id: guard.pc_org_id,
      auth_user_id: guard.auth_user_id,
      month_window: { start: windowStartISO, end: windowEndISO },
      can_write_quota: !writeAccessErr && canWriteQuota === true,
      write_access_error: writeAccessErr ?? null,
    }),
  });
}

export async function POST() {
  return handler();
}

export async function GET() {
  return handler();
}