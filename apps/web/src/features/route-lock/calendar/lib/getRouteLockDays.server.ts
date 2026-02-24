// RUN THIS
// Replace the entire file:
// apps/web/src/features/route-lock/calendar/lib/getRouteLockDays.server.ts

import { todayInNY, eachDayISO } from "@/features/route-lock/calendar/lib/fiscalMonth";

type Sb = any;

type FiscalMonth = {
  fiscal_month_id: string;
  start_date: string;
  end_date: string;
  label: string | null;
};

export type CalendarDayRow = {
  date: string;

  quota_hours: number | null;
  quota_routes: number | null;
  quota_units: number | null;

  scheduled_routes: number;
  scheduled_techs: number;

  total_headcount: number;
  util_pct: number | null;

  delta_forecast: number | null;

  has_sv: boolean;
  has_check_in: boolean;

  // actual snapshot (only when C present)
  actual_techs: number | null;
  actual_units: number | null;
  actual_hours: number | null;
  actual_jobs: number | null;
};

function n(v: any): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function safePct(num: number, den: number): number | null {
  if (!den) return null;
  const p = num / den;
  if (!Number.isFinite(p)) return null;
  return Math.round(p * 1000) / 10; // 1 decimal place percent
}

function ceilRoutesFromHours(hours: number): number {
  // 8 hrs == 1 route-day
  return Math.ceil(hours / 8);
}

async function resolveFiscalMonthForDate(sb: Sb, anchorISO: string): Promise<FiscalMonth | null> {
  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .lte("start_date", anchorISO)
    .gte("end_date", anchorISO)
    .maybeSingle();

  if (error || !data?.fiscal_month_id) return null;

  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date),
    end_date: String(data.end_date),
    label: (data.label as string | null) ?? null,
  };
}

async function resolveFiscalMonthById(sb: Sb, fiscal_month_id: string): Promise<FiscalMonth | null> {
  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .eq("fiscal_month_id", fiscal_month_id)
    .maybeSingle();

  if (error || !data?.fiscal_month_id) return null;

  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date),
    end_date: String(data.end_date),
    label: (data.label as string | null) ?? null,
  };
}

/**
 * Headcount (stable) — keep your existing roster logic simple here:
 * If this fails for any org, calendar still renders (HC becomes 0).
 */
async function computeHeadcount(sb: Sb, pc_org_id: string): Promise<number> {
  // v_roster_current is already pc_org scoped
  const { data, error } = await sb.from("v_roster_current").select("person_id").eq("pc_org_id", pc_org_id);
  if (error) {
    console.warn("headcount(v_roster_current) failed:", error.message);
    return 0;
  }
  const set = new Set<string>((data ?? []).map((r: any) => String(r?.person_id ?? "").trim()).filter(Boolean));
  return set.size;
}

async function computeScheduleAgg(
  sb: Sb,
  pc_org_id: string,
  start: string,
  end: string
): Promise<Map<string, { routes: number; techs: Set<string> }>> {
  const { data, error } = await sb
    .from("schedule_day_fact")
    .select("shift_date,tech_id,planned_route_id")
    .eq("pc_org_id", pc_org_id)
    .gte("shift_date", start)
    .lte("shift_date", end);

  if (error) {
    console.warn("schedule_day_fact query failed:", error.message);
    return new Map();
  }

  const byDay = new Map<string, { routes: number; techs: Set<string> }>();
  for (const r of (data ?? []) as any[]) {
    const d = String(r.shift_date ?? "").slice(0, 10);
    if (!d) continue;

    const tech = String(r.tech_id ?? "").trim();
    const hasRoute =
      r.planned_route_id !== null && r.planned_route_id !== undefined && String(r.planned_route_id).trim() !== "";

    const cur = byDay.get(d) ?? { routes: 0, techs: new Set<string>() };
    if (tech) cur.techs.add(tech);
    if (hasRoute) cur.routes += 1;

    byDay.set(d, cur);
  }

  return byDay;
}

/**
 * ✅ Quota is ROUTE-GRAIN (pc_org_id, shift_date, route_id).
 * For calendar, we need DAY-GRAIN totals:
 *  - quota_hours = sum(quota_hours) per shift_date
 *  - quota_units = sum(quota_units) per shift_date
 *  - quota_routes = ceil(quota_hours / 8)   (routes are derived, NOT row_count)
 */
async function computeQuota(
  sb: Sb,
  pc_org_id: string,
  start: string,
  end: string
): Promise<Map<string, { quota_hours: number | null; quota_routes: number | null; quota_units: number | null }>> {
  const { data, error } = await sb
    .from("quota_day_fact")
    .select("shift_date,quota_hours,quota_units")
    .eq("pc_org_id", pc_org_id)
    .gte("shift_date", start)
    .lte("shift_date", end);

  if (error) {
    console.warn("quota_day_fact query failed:", error.message);
    return new Map();
  }

  const temp = new Map<string, { hours: number; units: number }>();

  for (const r of (data ?? []) as any[]) {
    const d = String(r.shift_date ?? "").slice(0, 10);
    if (!d) continue;

    const cur = temp.get(d) ?? { hours: 0, units: 0 };
    cur.hours += n(r.quota_hours) ?? 0;
    cur.units += n(r.quota_units) ?? 0;
    temp.set(d, cur);
  }

  const out = new Map<string, { quota_hours: number | null; quota_routes: number | null; quota_units: number | null }>();

  for (const [d, v] of temp.entries()) {
    const routes = v.hours ? Math.ceil(v.hours / 8) : 0;
    out.set(d, {
      quota_hours: v.hours,
      quota_routes: routes,
      quota_units: v.units || (v.hours ? v.hours * 12 : 0),
    });
  }

  return out;
}

async function computeShiftValidationPresence(sb: Sb, pc_org_id: string, start: string, end: string): Promise<Set<string>> {
  const { data, error } = await sb
    .from("shift_validation_day_fact")
    .select("shift_date")
    .eq("pc_org_id", pc_org_id)
    .gte("shift_date", start)
    .lte("shift_date", end);

  if (error) {
    console.warn("shift_validation_day_fact query failed:", error.message);
    return new Set();
  }

  return new Set<string>((data ?? []).map((r: any) => String(r?.shift_date ?? "").slice(0, 10)).filter(Boolean));
}

async function computeCheckInActuals(
  sb: Sb,
  pc_org_id: string,
  start: string,
  end: string
): Promise<Map<string, { techs: Set<string>; units: number; hours: number; jobs: number }>> {
  const { data, error } = await sb
    .from("check_in_day_fact")
    .select("shift_date,tech_id,actual_units,actual_hours,actual_jobs")
    .eq("pc_org_id", pc_org_id)
    .gte("shift_date", start)
    .lte("shift_date", end);

  if (error) {
    console.warn("check_in_day_fact query failed:", error.message);
    return new Map();
  }

  const byDay = new Map<string, { techs: Set<string>; units: number; hours: number; jobs: number }>();

  for (const r of (data ?? []) as any[]) {
    const d = String(r.shift_date ?? "").slice(0, 10);
    if (!d) continue;

    const tech = String(r.tech_id ?? "").trim();
    const cur = byDay.get(d) ?? { techs: new Set<string>(), units: 0, hours: 0, jobs: 0 };

    if (tech) cur.techs.add(tech);
    cur.units += n(r.actual_units) ?? 0;
    cur.hours += n(r.actual_hours) ?? 0;
    cur.jobs += n(r.actual_jobs) ?? 0;

    byDay.set(d, cur);
  }

  return byDay;
}

export async function getRouteLockDaysForFiscalMonth(sb: Sb, pc_org_id: string, fiscal_month_id: string) {
  const fm = await resolveFiscalMonthById(sb, fiscal_month_id);
  if (!fm) return { ok: false as const, error: "Could not resolve fiscal month (fiscal_month_dim by id)" };

  const start = fm.start_date;
  const end = fm.end_date;

  const days = eachDayISO(start, end);

  const [total_headcount, scheduleByDay, quotaByDay, svSet, actualByDay] = await Promise.all([
    computeHeadcount(sb, pc_org_id),
    computeScheduleAgg(sb, pc_org_id, start, end),
    computeQuota(sb, pc_org_id, start, end),
    computeShiftValidationPresence(sb, pc_org_id, start, end),
    computeCheckInActuals(sb, pc_org_id, start, end),
  ]);

  const out: CalendarDayRow[] = days.map((d) => {
    const sched = scheduleByDay.get(d);
    const scheduled_routes = sched?.routes ?? 0;
    const scheduled_techs = sched?.techs.size ?? 0;

    const quota = quotaByDay.get(d) ?? { quota_hours: null, quota_routes: null, quota_units: null };

    const util_pct = safePct(scheduled_techs, total_headcount);

    const delta_forecast = quota.quota_routes === null ? null : scheduled_routes - quota.quota_routes;

    const actual = actualByDay.get(d);
    const has_check_in = !!actual && actual.techs.size > 0;

    return {
      date: d,

      quota_hours: quota.quota_hours,
      quota_routes: quota.quota_routes,
      quota_units: quota.quota_units,

      scheduled_routes,
      scheduled_techs,

      total_headcount,
      util_pct,

      delta_forecast,

      has_sv: svSet.has(d),
      has_check_in,

      actual_techs: has_check_in ? actual!.techs.size : null,
      actual_units: has_check_in ? actual!.units : null,
      actual_hours: has_check_in ? actual!.hours : null,
      actual_jobs: has_check_in ? actual!.jobs : null,
    };
  });

  return { ok: true as const, fiscal: fm, days: out };
}

export async function getRouteLockDaysForCurrentFiscalMonth(sb: Sb, pc_org_id: string) {
  const today = todayInNY();
  const fm = await resolveFiscalMonthForDate(sb, today);
  if (!fm) return { ok: false as const, error: "Could not resolve fiscal month (fiscal_month_dim)" };

  return getRouteLockDaysForFiscalMonth(sb, pc_org_id, fm.fiscal_month_id);
}

export async function getRouteLockDaysForNextFiscalMonth(sb: Sb, pc_org_id: string) {
  const today = todayInNY();
  const cur = await resolveFiscalMonthForDate(sb, today);
  if (!cur) return { ok: false as const, error: "Could not resolve current fiscal month" };

  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .gt("start_date", String(cur.end_date))
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.fiscal_month_id) return { ok: false as const, error: "Could not resolve next fiscal month" };

  return getRouteLockDaysForFiscalMonth(sb, pc_org_id, String(data.fiscal_month_id));
}

export async function getRouteLockDaysForPrevFiscalMonth(sb: Sb, pc_org_id: string) {
  const today = todayInNY();
  const cur = await resolveFiscalMonthForDate(sb, today);
  if (!cur) return { ok: false as const, error: "Could not resolve current fiscal month" };

  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .lt("end_date", String(cur.start_date))
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.fiscal_month_id) return { ok: false as const, error: "Could not resolve previous fiscal month" };

  return getRouteLockDaysForFiscalMonth(sb, pc_org_id, String(data.fiscal_month_id));
}