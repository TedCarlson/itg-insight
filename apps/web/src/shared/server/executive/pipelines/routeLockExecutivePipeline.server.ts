import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type { ExecutiveDimensionPayload } from "@/shared/types/executive/executiveSuite";
import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";
import {
  getRouteLockDaysForCurrentFiscalMonth,
  getRouteLockDaysForNextFiscalMonth,
  type CalendarDayRow,
} from "@/features/route-lock/calendar/lib/getRouteLockDays.server";

const DIRECTOR_ROUTE_LOCK_HREF = "/director/executive?dimension=route-lock";

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)} ${dow}`;
}

function runRatePct(day: CalendarDayRow): number | null {
  const quota = Number(day.quota_routes ?? 0);
  const plannedRun = Number(day.scheduled_routes ?? 0);

  if (!quota || !Number.isFinite(quota)) return null;

  const pct = (plannedRun / quota) * 100;
  if (!Number.isFinite(pct)) return null;

  return Math.round(pct * 10) / 10;
}

function lockStatus(day: CalendarDayRow): "MET" | "MISS" | "NO QUOTA" {
  if (day.quota_routes === null || day.quota_routes === undefined) {
    return "NO QUOTA";
  }

  const delta = day.delta_forecast;
  if (typeof delta === "number" && Number.isFinite(delta) && delta >= 0) {
    return "MET";
  }

  return "MISS";
}

function fmtRunRate(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function fmtQuota(value: number | null): string {
  return value === null ? "—" : String(value);
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

  const [currentRes, nextRes] = await Promise.all([
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
          title: "7-Day Readiness",
          description: "Route-Lock forecast could not be loaded from the existing operational payload.",
          status: "degraded",
          href: DIRECTOR_ROUTE_LOCK_HREF,
          cards: [],
        },
      ],
    };
  }

  const mergedDays = uniqueByDate([
    ...currentRes.days,
    ...(nextRes && nextRes.ok ? nextRes.days : []),
  ]);

  const next7 = mergedDays
    .filter((day) => day.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7);

  if (!next7.length) {
    return {
      dimension: "route_lock",
      title: "Route-Lock",
      status: "empty",
      artifacts: [
        {
          key: "route_lock_7_day",
          title: "7-Day Readiness",
          description: "No Route-Lock forecast days are available for the rolling window.",
          status: "empty",
          href: DIRECTOR_ROUTE_LOCK_HREF,
          cards: [],
        },
      ],
    };
  }

  const missCount = next7.filter((day) => lockStatus(day) === "MISS").length;
  const noQuotaCount = next7.filter((day) => lockStatus(day) === "NO QUOTA").length;
  const readyStatus = missCount || noQuotaCount ? "degraded" : "ready";

  return {
    dimension: "route_lock",
    title: "Route-Lock",
    status: readyStatus,
    artifacts: [
      {
        key: "route_lock_7_day",
        title: "7-Day Readiness",
        description: "Rolling Route-Lock snapshot anchored on today: date, quota, run rate, and lock status.",
        status: readyStatus,
        href: DIRECTOR_ROUTE_LOCK_HREF,
        cards: next7.map((day) => {
          const runRate = runRatePct(day);
          const lock = lockStatus(day);

          return {
            key: day.date,
            label: formatDateLabel(day.date),
            value: fmtQuota(day.quota_routes),
            helper: `${fmtRunRate(runRate)} • ${lock}`,
            status: lock === "MET" ? "ready" : "degraded",
            meta: {
              date: day.date,
              date_label: formatDateLabel(day.date),
              quota: day.quota_routes,
              run_rate: runRate,
              run_rate_display: fmtRunRate(runRate),
              lock_status: lock,
              delta: day.delta_forecast,
            },
          };
        }),
      },
    ],
    notes:
      missCount || noQuotaCount
        ? [
            `${missCount} day${missCount === 1 ? "" : "s"} below lock`,
            `${noQuotaCount} day${noQuotaCount === 1 ? "" : "s"} missing quota`,
          ]
        : undefined,
  };
}