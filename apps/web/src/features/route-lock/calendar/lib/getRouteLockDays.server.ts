// RUN THIS
// Replace the entire file:
// apps/web/src/features/route-lock/calendar/lib/getRouteLockDays.server.ts

import { cache } from "react";

type Sb = any;

export type FiscalMonthRow = {
  fiscal_month_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD (your fiscal_end_date)
  label?: string | null;
};

export type CalendarDayRow = {
  date: string; // YYYY-MM-DD

  quota_hours: number | null;
  quota_routes: number | null;
  quota_units: number | null;

  scheduled_routes: number; // used as "capacity" in routes-mode
  scheduled_techs: number;

  total_headcount: number;
  util_pct: number | null;

  delta_forecast: number | null;

  has_sv: boolean;
  has_check_in: boolean;

  actual_techs: number | null;
  actual_units: number | null;
  actual_hours: number | null;
  actual_jobs: number | null;
};

const DEBUG = false; // flip false when done

function n0(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function safePct(numer: number, denom: number): number | null {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return null;
  return Math.round((numer / denom) * 100);
}

function todayInNY(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function eachDayISO(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
}

const resolveFiscalMonthById = cache(async (sb: Sb, fiscal_month_id: string): Promise<FiscalMonthRow | null> => {
  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .eq("fiscal_month_id", fiscal_month_id)
    .maybeSingle();

  if (error || !data?.fiscal_month_id) return null;
  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date).slice(0, 10),
    end_date: String(data.end_date).slice(0, 10),
    label: data.label ?? null,
  };
});

const resolveFiscalMonthForDate = cache(async (sb: Sb, isoDate: string): Promise<FiscalMonthRow | null> => {
  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .lte("start_date", isoDate)
    .gte("end_date", isoDate)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.fiscal_month_id) return null;
  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date).slice(0, 10),
    end_date: String(data.end_date).slice(0, 10),
    label: data.label ?? null,
  };
});

async function computeHeadcountByDay(sb: Sb, pc_org_id: string, start: string, end: string): Promise<Map<string, number>> {
  const { data, error } = await sb
    .from("v_roster_active")
    .select("person_id,start_date,end_date")
    .eq("pc_org_id", pc_org_id);

  if (error) {
    console.warn("v_roster_active query failed:", error.message);
    return new Map();
  }

  const days = eachDayISO(start, end);
  const out = new Map<string, number>();
  for (const d of days) out.set(d, 0);

  for (const r of (data ?? []) as any[]) {
    const s = String(r.start_date ?? "").slice(0, 10) || null;
    const e = String(r.end_date ?? "").slice(0, 10) || null;

    const activeStart = s && s > start ? s : start;
    const activeEnd = e && e < end ? e : end;

    if (!activeStart || !activeEnd) continue;
    if (activeEnd < activeStart) continue;

    let cur = activeStart;
    while (cur <= activeEnd) {
      out.set(cur, (out.get(cur) ?? 0) + 1);
      cur = addDaysISO(cur, 1);
    }
  }

  return out;
}

async function computeScheduleAgg(
  sb: Sb,
  pc_org_id: string,
  start: string,
  end: string
): Promise<Map<string, { techs: Set<string>; routes: number }>> {
  // ✅ CRITICAL: Supabase select() returns max 1000 rows unless you page.
  // Your month has 1078 rows, so 03/21 is getting clipped.
  const endExclusive = addDaysISO(end, 1);

  const pageSize = 1000;
  let from = 0;
  let all: any[] = [];

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await sb
      .from("schedule_day_fact")
      .select("shift_date,tech_id")
      .eq("pc_org_id", pc_org_id)
      .gte("shift_date", start)
      .lt("shift_date", endExclusive)
      .range(from, to);

    if (error) {
      console.warn("schedule_day_fact query failed:", error.message);
      return new Map();
    }

    const rows = (data ?? []) as any[];
    all = all.concat(rows);

    if (rows.length < pageSize) break; // last page
    from += pageSize;
  }

  if (DEBUG) {
    let min: string | null = null;
    let max: string | null = null;

    for (const r of all) {
      const d = String(r?.shift_date ?? "").slice(0, 10);
      if (!d) continue;
      if (min === null || d < min) min = d;
      if (max === null || d > max) max = d;
    }

    const has0321 = all.some((r) => String(r?.shift_date ?? "").slice(0, 10) === "2026-03-21");
    console.log("DEBUG SCHED QUERY", {
      pc_org_id,
      start,
      end,
      endExclusive,
      rowCount: all.length,
      min_shift_date: min,
      max_shift_date: max,
      firstRow: all[0] ?? null,
      has_2026_03_21: has0321,
    });
  }

  const byDay = new Map<string, { techs: Set<string>; routes: number }>();

  for (const r of all) {
    const d = String(r.shift_date ?? "").slice(0, 10);
    if (!d) continue;

    const tech = String(r.tech_id ?? "").trim();
    const cur = byDay.get(d) ?? { techs: new Set<string>(), routes: 0 };

    if (tech) cur.techs.add(tech);

    // Planning capacity: routes == scheduled tech rows (tech-capacity in routes-mode)
    cur.routes += 1;

    byDay.set(d, cur);
  }

  if (DEBUG) {
    const v = byDay.get("2026-03-21");
    console.log("DEBUG 03-21 SCHEDULE AGG", {
      found: !!v,
      routes: v?.routes ?? 0,
      techs: v?.techs.size ?? 0,
    });
  }

  return byDay;
}

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

  const byDay = new Map<string, { quota_hours: number | null; quota_routes: number | null; quota_units: number | null }>();

  for (const r of (data ?? []) as any[]) {
    const d = String(r.shift_date ?? "").slice(0, 10);
    if (!d) continue;

    const cur = byDay.get(d) ?? { quota_hours: 0, quota_routes: 0, quota_units: 0 };

    cur.quota_hours = (cur.quota_hours ?? 0) + n0(r.quota_hours);
    cur.quota_units = (cur.quota_units ?? 0) + n0(r.quota_units);

    byDay.set(d, cur);
  }

  for (const [d, v] of byDay.entries()) {
    const hours = v.quota_hours ?? null;
    const routes = hours === null ? null : Math.ceil(hours / 8);
    byDay.set(d, { quota_hours: hours, quota_units: v.quota_units ?? null, quota_routes: routes });
  }

  return byDay;
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
    cur.units += n0(r.actual_units);
    cur.hours += n0(r.actual_hours);
    cur.jobs += n0(r.actual_jobs);

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

  const [headcountByDay, scheduleByDay, quotaByDay, svSet, actualByDay] = await Promise.all([
    computeHeadcountByDay(sb, pc_org_id, start, end),
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

    const total_headcount = headcountByDay.get(d) ?? 0;
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