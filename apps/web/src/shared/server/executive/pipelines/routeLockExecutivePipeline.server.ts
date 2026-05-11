// path: apps/web/src/shared/server/executive/pipelines/routeLockExecutivePipeline.server.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type { ExecutiveDimensionPayload } from "@/shared/types/executive/executiveSuite";
import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";
import {
  getRouteLockDaysForCurrentFiscalMonth,
  getRouteLockDaysForNextFiscalMonth,
  getRouteLockDaysForPrevFiscalMonth,
  type CalendarDayRow,
} from "@/features/route-lock/calendar/lib/getRouteLockDays.server";

const DIRECTOR_ROUTE_LOCK_HREF = "/director/route-lock";
const POINTS_PER_ROUTE = 96;

type DayState = "planned" | "built" | "actual";
type LockVerdict = "MEETS" | "MISSES" | "MET" | "MISSED" | "NA";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)} ${dow}`;
}

function n(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function count(value: unknown): number {
  return n(value) ?? 0;
}

function safePct(num: number | null, den: number | null): number | null {
  if (num === null || !den) return null;
  const pct = (num / den) * 100;
  return Number.isFinite(pct) ? Math.round(pct * 10) / 10 : null;
}

function stateForDay(day: CalendarDayRow): DayState {
  if (day.has_check_in) return "actual";
  if (day.has_sv) return "built";
  return "planned";
}

function phaseLabel(state: DayState): string {
  if (state === "actual") return "Actual";
  if (state === "built") return "Built";
  return "Planned";
}

function quotaPointsForDay(day: CalendarDayRow): number | null {
  return n(day.quota_units) ?? (n(day.quota_hours) === null ? null : count(day.quota_hours) * 12);
}

function isNearRoutes(lockEligible: number | null, quotaRoutes: number | null): boolean {
  if (lockEligible === null || quotaRoutes === null || quotaRoutes <= 0) return false;
  return lockEligible < quotaRoutes && lockEligible >= quotaRoutes * 0.9;
}

function computeVerdict(args: {
  state: DayState;
  lockEligible: number | null;
  quotaRoutes: number | null;
  phasePoints: number | null;
  quotaPoints: number | null;
}): LockVerdict {
  const { state, lockEligible, quotaRoutes, phasePoints, quotaPoints } = args;

  if (quotaRoutes === null || lockEligible === null) return "NA";

  const success =
    lockEligible >= quotaRoutes ||
    (isNearRoutes(lockEligible, quotaRoutes) &&
      quotaPoints !== null &&
      phasePoints !== null &&
      phasePoints >= quotaPoints);

  if (state === "actual") return success ? "MET" : "MISSED";
  return success ? "MEETS" : "MISSES";
}

function computeRouteLockSummary(day: CalendarDayRow) {
  const state = stateForDay(day);

  const work = count(day.work_count);
  const bplow = count(day.bplow_count);
  const prjt = count(day.prjt_count);
  const trvl = count(day.trvl_count);
  const bptrl = count(day.bptrl_count);

  const quotaRoutes = n(day.quota_routes);
  const quotaPoints = quotaPointsForDay(day);

  const plannedEligible = count(day.planned_field_count ?? day.scheduled_routes);
  const builtEligible = work + bplow + prjt;

  const actualTechs = n(day.actual_techs);
  const actualEligible =
    actualTechs === null ? null : actualTechs - trvl - bptrl + bplow + prjt;

  const lockEligible =
    state === "actual" ? actualEligible : state === "built" ? builtEligible : plannedEligible;

  const phasePoints =
    state === "actual"
      ? n(day.actual_units)
      : lockEligible === null
        ? null
        : lockEligible * POINTS_PER_ROUTE;

  const routeNet =
    quotaRoutes === null || lockEligible === null ? null : lockEligible - quotaRoutes;

  const runRate = safePct(lockEligible, quotaRoutes);

  const verdict = computeVerdict({
    state,
    lockEligible,
    quotaRoutes,
    phasePoints,
    quotaPoints,
  });

  return {
    state,
    phase: phaseLabel(state),
    quotaRoutes,
    lockEligible,
    routeNet,
    runRate,
    verdict,
  };
}

function fmt(value: number | null): string {
  if (value === null) return "—";
  return String(Math.round(value * 10) / 10);
}

function fmtPct(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 10) / 10}%`;
}

function uniqueByDate(days: CalendarDayRow[]): CalendarDayRow[] {
  const seen = new Set<string>();
  const out: CalendarDayRow[] = [];

  for (const day of days) {
    if (!day.date || seen.has(day.date)) continue;
    seen.add(day.date);
    out.push(day);
  }

  return out;
}

export async function buildRouteLockExecutiveDimension(args: {
  pc_org_id: string;
  as_of_date: string;
}): Promise<ExecutiveDimensionPayload> {
  const sb = supabaseAdmin();
  const today = todayInNY();

  const [prevRes, currentRes, nextRes] = await Promise.all([
    getRouteLockDaysForPrevFiscalMonth(sb, args.pc_org_id).catch(() => null),
    getRouteLockDaysForCurrentFiscalMonth(sb, args.pc_org_id),
    getRouteLockDaysForNextFiscalMonth(sb, args.pc_org_id).catch(() => null),
  ]);

  if (!currentRes.ok) {
    return {
      dimension: "route_lock",
      title: "Route-Lock",
      status: "degraded",
      notes: [currentRes.error],
      artifacts: [
        {
          key: "route_lock_7_day",
          title: "15-Day Route Lock",
          description: "Route-Lock summary could not be loaded from the existing operational payload.",
          status: "degraded",
          href: DIRECTOR_ROUTE_LOCK_HREF,
          cards: [],
        },
      ],
    };
  }

  const windowStart = addDaysISO(today, -7);
  const windowEnd = addDaysISO(today, 7);

  const mergedDays = uniqueByDate([
    ...(prevRes && prevRes.ok ? prevRes.days : []),
    ...currentRes.days,
    ...(nextRes && nextRes.ok ? nextRes.days : []),
  ]);

  const windowDays = mergedDays
    .filter((day) => day.date >= windowStart && day.date <= windowEnd)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!windowDays.length) {
    return {
      dimension: "route_lock",
      title: "Route-Lock",
      status: "empty",
      artifacts: [
        {
          key: "route_lock_7_day",
          title: "15-Day Route Lock",
          description: "No Route-Lock days are available for the rolling 15-day window.",
          status: "empty",
          href: DIRECTOR_ROUTE_LOCK_HREF,
          cards: [],
        },
      ],
    };
  }

  const summaries = windowDays.map((day) => ({
    day,
    summary: computeRouteLockSummary(day),
  }));

  const missCount = summaries.filter((row) =>
    row.summary.verdict === "MISSES" || row.summary.verdict === "MISSED"
  ).length;

  const readyStatus = missCount ? "degraded" : "ready";

  return {
    dimension: "route_lock",
    title: "Route-Lock",
    status: readyStatus,
    artifacts: [
      {
        key: "route_lock_7_day",
        title: "15-Day Route Lock",
        description: "Previous 7 days, today, and next 7 days using the same lock math as the Route-Lock calendar.",
        status: readyStatus,
        href: DIRECTOR_ROUTE_LOCK_HREF,
        cards: summaries.map(({ day, summary }) => ({
          key: day.date,
          label: formatDateLabel(day.date),
          value: fmt(summary.lockEligible),
          helper: `${summary.phase} • ${summary.verdict}`,
          status:
            summary.verdict === "MET" || summary.verdict === "MEETS"
              ? "ready"
              : summary.verdict === "NA"
                ? "empty"
                : "degraded",
          meta: {
            date: day.date,
            date_label: formatDateLabel(day.date),
            is_today: day.date === today,
            phase: summary.phase,
            quota: summary.quotaRoutes,
            eligible: summary.lockEligible,
            route_net: summary.routeNet,
            run_rate: summary.runRate,
            run_rate_display: fmtPct(summary.runRate),
            lock_status: summary.verdict,
          },
        })),
      },
    ],
    notes: missCount ? [`${missCount} day${missCount === 1 ? "" : "s"} below lock`] : undefined,
  };
}