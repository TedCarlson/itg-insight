// path: apps/web/src/shared/schedule/server/buildScheduleDailySummaries.server.ts

import type {
  DispatchDayFactRow,
} from "@/shared/server/dispatch/loadDispatchDayFacts.server";

import type {
  ScheduleDailySummary,
  ScheduleSurfaceRow,
} from "../types/scheduleSurfaceTypes";

function addDays(
  isoDate: string,
  days: number,
) {
  const date =
    new Date(`${isoDate}T00:00:00.000Z`);

  date.setUTCDate(
    date.getUTCDate() + days,
  );

  return date.toISOString().slice(0, 10);
}

function datesBetween(
  startDate: string,
  endDate: string,
) {
  const out: string[] = [];

  let cursor =
    startDate;

  while (cursor <= endDate) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return out;
}

export function buildScheduleDailySummaries(args: {
  startDate: string;
  endDate: string;
  rows: ScheduleSurfaceRow[];
  dispatchFacts?: DispatchDayFactRow[];
  activeCapacityCount?: number;
}): ScheduleDailySummary[] {

  const dispatchByDate =
    new Map<string, DispatchDayFactRow>();

  for (const fact of args.dispatchFacts ?? []) {
    dispatchByDate.set(fact.shift_date, fact);
  }

  return datesBetween(
    args.startDate,
    args.endDate,
  ).map((date) => {

    const rowsForDate =
      args.rows.filter((row) => row.date === date);

    const dispatchFact =
      dispatchByDate.get(date) ?? null;

    const scheduledCount =
      rowsForDate.filter((row) => row.baseSchedule.scheduled).length;

    const quotaRouteCount =
      dispatchFact?.quota_routes_required ?? null;

    const meetsLockSignal =
      quotaRouteCount == null || quotaRouteCount <= 0
        ? "unknown"
        : scheduledCount >= quotaRouteCount
          ? "met"
          : scheduledCount >= Math.ceil(quotaRouteCount * 0.9)
            ? "watch"
            : "miss";

    return {
      date,

      scheduledCount,

      offCount:
        Math.max((args.activeCapacityCount ?? 0) - scheduledCount, 0),

      plannedRouteCount:
        scheduledCount,

      plannedUnitCount:
        dispatchFact?.quota_units ?? null,

      quotaRouteCount,

      quotaUnitCount:
        dispatchFact?.quota_units ?? null,

      meetsLockSignal,

      approvedTimeOffCount: 0,
      pendingTimeOffCount: 0,
      deniedTimeOffCount: 0,

      callOutCount:
        rowsForDate.filter((row) => row.dispatch.callOut).length,

      addInCount:
        rowsForDate.filter((row) => row.dispatch.addIn).length,

      techMoveCount:
        rowsForDate.filter((row) => row.dispatch.techMove).length,

      incidentCount:
        rowsForDate.reduce((sum, row) => sum + row.dispatch.incidentCount, 0),

      noteCount:
        rowsForDate.reduce((sum, row) => sum + row.dispatch.noteCount, 0),

      isFiscalMonthEnd:
        date.endsWith("-21"),

      fiscalAnchorLabel:
        date.endsWith("-21")
          ? "Fiscal Month End"
          : null,
    };
  });
}
