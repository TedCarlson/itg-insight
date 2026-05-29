// apps/web/src/app/api/route-lock/quota/list/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type GuardOk = { ok: true; pc_org_id: string; auth_user_id: string; apiClient: any };
type GuardFail = { ok: false; status: number; error: string; debug?: any };

async function hasAnyRole(admin: any, auth_user_id: string, roleKeys: string[]): Promise<boolean> {
  const { data, error } = await admin.from("user_roles").select("role_key").eq("auth_user_id", auth_user_id);
  if (error) return false;
  const roles = (data ?? []).map((r: any) => String(r?.role_key ?? ""));
  return roles.some((rk: string) => roleKeys.includes(rk));
}

async function guardSelectedOrgQuotaAccess(): Promise<GuardOk | GuardFail> {
  const sb = await supabaseServer();
  const admin = supabaseAdmin();

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (userErr || !user?.id) return { ok: false, status: 401, error: "unauthorized", debug: { step: "no_user" } };
  const userId = user.id;

  const { data: profile, error: profErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id,status")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (profErr) return { ok: false, status: 500, error: profErr.message, debug: { step: "profile_read_error", profErr } };

  const pc_org_id = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pc_org_id) return { ok: false, status: 409, error: "No PC org selected", debug: { step: "no_selected_org" } };

  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;

  const { data: canAccess, error: accessErr } = await apiClient.rpc("can_access_pc_org", { p_pc_org_id: pc_org_id });
  if (accessErr || !canAccess) return { ok: false, status: 403, error: "forbidden", debug: { step: "baseline_access_rpc", accessErr, canAccess } };

  const { data: ownerRow, error: ownerErr } = await admin
    .from("app_owners")
    .select("auth_user_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (ownerErr) return { ok: false, status: 500, error: ownerErr.message, debug: { step: "owner_check_error", ownerErr } };
  if (ownerRow?.auth_user_id) return { ok: true, pc_org_id, auth_user_id: userId, apiClient };

  const roleAllowed = await hasAnyRole(admin, userId, ["admin", "dev", "director", "manager", "vp"]);
  if (roleAllowed) return { ok: true, pc_org_id, auth_user_id: userId, apiClient };

  const { data: allowedByGrant, error: grantRpcErr } = await apiClient.rpc("has_any_pc_org_permission", {
    p_pc_org_id: pc_org_id,
    p_permission_keys: ["route_lock_manage", "roster_manage"],
  });

  if (grantRpcErr) return { ok: false, status: 403, error: "forbidden", debug: { step: "grant_rpc_error", grantRpcErr } };
  if (!allowedByGrant) return { ok: false, status: 403, error: "forbidden", debug: { step: "no_matching_grant" } };

  return { ok: true, pc_org_id, auth_user_id: userId, apiClient };
}

export async function POST(req: Request) {
  try {
    const guard = await guardSelectedOrgQuotaAccess();
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error, debug: guard.debug ?? null }, { status: guard.status });

    const admin = supabaseAdmin();
    const body = (await req.json().catch(() => ({}))) as any;

    const fiscal_month_id = String(body?.fiscal_month_id ?? "").trim() || null;
    const limitRaw = Number(body?.limit ?? 500);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 2000) : 500;

    let q = admin.from("quota_admin_v").select("*").eq("pc_org_id", guard.pc_org_id);
    if (fiscal_month_id) q = q.eq("fiscal_month_id", fiscal_month_id);

    const { data, error } = await q
      .order("fiscal_month_start_date", { ascending: false })
      .order("route_name", { ascending: true })
      .limit(limit);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const rows = data ?? [];

    const summaryByMonth = new Map<string, any>();

    for (const row of rows as any[]) {
      const fiscalMonthId = String(row.fiscal_month_id ?? row.fiscal_month_key ?? row.fiscal_month_label ?? "");
      if (!fiscalMonthId) continue;

      const current = summaryByMonth.get(fiscalMonthId) ?? {
        fiscal_month_id: fiscalMonthId,
        fiscal_month_key: row.fiscal_month_key ?? null,
        fiscal_month_label: row.fiscal_month_label ?? null,
        fiscal_month_start_date: row.fiscal_month_start_date ?? null,
        fiscal_month_end_date: row.fiscal_month_end_date ?? null,
        route_count: 0,
        row_count: 0,
        total_hours: 0,
        total_units: 0,
        tech_days: 0,
        estimated_headcount: 0,
        hours_delta_mom: null,
      };

      current.row_count += 1;
      current.route_count += row.route_id ? 1 : 0;

      const hours =
        Number(row.qt_hours ?? 0) ||
        Number(row.qh_sun ?? 0) +
          Number(row.qh_mon ?? 0) +
          Number(row.qh_tue ?? 0) +
          Number(row.qh_wed ?? 0) +
          Number(row.qh_thu ?? 0) +
          Number(row.qh_fri ?? 0) +
          Number(row.qh_sat ?? 0);

      current.total_hours += hours;
      current.total_units += Number(row.qt_units ?? hours * 12);

      current.tech_days +=
        Math.ceil(Number(row.qh_sun ?? 0) / 8) +
        Math.ceil(Number(row.qh_mon ?? 0) / 8) +
        Math.ceil(Number(row.qh_tue ?? 0) / 8) +
        Math.ceil(Number(row.qh_wed ?? 0) / 8) +
        Math.ceil(Number(row.qh_thu ?? 0) / 8) +
        Math.ceil(Number(row.qh_fri ?? 0) / 8) +
        Math.ceil(Number(row.qh_sat ?? 0) / 8);

      summaryByMonth.set(fiscalMonthId, current);
    }

    const monthlySummaryAsc = Array.from(summaryByMonth.values()).sort((a, b) =>
      String(a.fiscal_month_start_date ?? a.fiscal_month_key ?? "").localeCompare(
        String(b.fiscal_month_start_date ?? b.fiscal_month_key ?? "")
      )
    );

    for (let i = 0; i < monthlySummaryAsc.length; i += 1) {
      const current = monthlySummaryAsc[i];
      const prior = monthlySummaryAsc[i - 1] ?? null;
      current.estimated_headcount = current.total_hours / 40;
      current.hours_delta_mom = prior ? current.total_hours - prior.total_hours : null;
    }

    const monthly_summary = monthlySummaryAsc;

    return NextResponse.json({
      ok: true,
      items: rows,
      monthly_summary,
      debug: {
        selected_pc_org_id: guard.pc_org_id,
        auth_user_id: guard.auth_user_id,
        returned: rows.length,
        monthly_summary_count: monthly_summary.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "List failed" }, { status: 500 });
  }
}