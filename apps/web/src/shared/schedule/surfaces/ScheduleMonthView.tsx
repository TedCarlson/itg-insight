// path: apps/web/src/shared/schedule/surfaces/ScheduleMonthView.tsx

"use client";

import { Card } from "@/components/ui/Card";

import type {
  ScheduleDailySummary,
  ScheduleSurfacePayload,
} from "../types/scheduleSurfaceTypes";

type Props = {
  payload: ScheduleSurfacePayload;
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildCalendarDates(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  const gridStart = addDays(startDate, -start.getUTCDay());
  const gridEnd = addDays(endDate, 6 - end.getUTCDay());

  const dates: string[] = [];
  let cursor = gridStart;

  while (cursor <= gridEnd) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function summaryByDate(summaries: ScheduleDailySummary[]) {
  return new Map(summaries.map((summary) => [summary.date, summary]));
}

function emptySummary(date: string): ScheduleDailySummary {
  return {
    date,
    scheduledCount: 0,
    offCount: 0,
    plannedBookedCount: 0,
    builtBookedCount: 0,
    actualBookedCount: 0,
    plannedRouteCount: null,
    plannedUnitCount: null,
    quotaRouteCount: null,
    quotaUnitCount: null,
    meetsLockSignal: "unknown",
    approvedTimeOffCount: 0,
    pendingTimeOffCount: 0,
    deniedTimeOffCount: 0,
    callOutCount: 0,
    addInCount: 0,
    techMoveCount: 0,
    bpLowCount: 0,
    incidentCount: 0,
    noteCount: 0,
    isFiscalMonthEnd: date.endsWith("-21"),
    fiscalAnchorLabel: date.endsWith("-21") ? "Fiscal Month End" : null,
  };
}

function missingActualCountForDate(
  summary: ScheduleDailySummary,
) {
  if (summary.actualBookedCount <= 0) {
    return 0;
  }

  return Math.max(summary.builtBookedCount - summary.actualBookedCount, 0);
}

function cardClass(args: {
  isToday: boolean;
  isFiscalMonthEnd: boolean;
  isCurrentMonth: boolean;
  isBlackout: boolean;
}) {
  return [
    "min-h-[112px] rounded-lg border bg-background px-2 py-2",
    args.isCurrentMonth ? "" : "opacity-40",
    args.isBlackout ? "bg-zinc-950/[0.035]" : "",
    args.isToday ? "border-2 border-blue-500 bg-blue-50/30" : "",
    !args.isToday && args.isFiscalMonthEnd ? "border-2 border-amber-400 bg-amber-50/20" : "",
  ].filter(Boolean).join(" ");
}

export default function ScheduleMonthView({ payload }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const lookup = summaryByDate(payload.dailySummaries);
  const dates = buildCalendarDates(payload.filters.startDate, payload.filters.endDate);
  const currentMonth = payload.filters.startDate.slice(0, 7);

  return (
    <div className="space-y-2">
      <div className="grid auto-cols-[minmax(190px,1fr)] grid-flow-col gap-1.5 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-7 xl:overflow-visible xl:pb-0">
        {dates.map((date) => {
          const summary = lookup.get(date) ?? emptySummary(date);
          const weekday = WEEKDAYS[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
          const isToday = date === today;
          const isCurrentMonth = date.slice(0, 7) === currentMonth;
          const blackoutDay = payload.blackoutByDate?.[date] ?? null;
          const blackoutLabel = blackoutDay?.rules?.[0]?.label ?? null;
          const isBlackout = Boolean(blackoutDay?.rules?.length);
          const missingActualCount =
            missingActualCountForDate(summary);

          const primaryBookedCount =
            summary.actualBookedCount > 0
              ? summary.actualBookedCount
              : summary.builtBookedCount > 0
                ? summary.builtBookedCount
                : summary.plannedBookedCount;

          const isUnderQuota =
            (summary.quotaRouteCount ?? 0) > primaryBookedCount;

          return (
            <Card
              key={date}
              className={cardClass({
                isToday,
                isFiscalMonthEnd: summary.isFiscalMonthEnd,
                isCurrentMonth,
                isBlackout,
              })}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>{weekday}</span>
                    {isToday ? (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                        Today
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {summary.fiscalAnchorLabel ? (
                      <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                        FM End
                      </span>
                    ) : null}

                    {isBlackout ? (
                      <span
                        title={blackoutLabel ?? "Blackout"}
                        className="rounded-full bg-black px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
                      >
                        Blackout
                      </span>
                    ) : null}

                    {missingActualCount > 0 ? (
                      <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                        Missing {missingActualCount}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="text-lg font-semibold leading-none">
                  {Number(date.slice(8, 10))}
                </div>
              </div>

              <div className="mt-3 grid gap-1 text-[11px]">
                {(summary.plannedBookedCount > 0 ||
                  summary.builtBookedCount > 0 ||
                  summary.actualBookedCount > 0) ? (
                  <div className="grid grid-cols-3 rounded-sm border border-zinc-200 text-center text-[10px]">
                    <div className="border-r border-zinc-200 px-1 py-0.5">
                      <div className="font-semibold text-zinc-500">PLN</div>
                      <div className="font-semibold tabular-nums text-zinc-900">{summary.plannedBookedCount}</div>
                    </div>

                    <div className="border-r border-zinc-200 px-1 py-0.5">
                      <div className="font-semibold text-zinc-500">BLD</div>
                      <div className="font-semibold tabular-nums text-zinc-900">{summary.builtBookedCount}</div>
                    </div>

                    <div className="px-1 py-0.5">
                      <div className="font-semibold text-zinc-500">ACT</div>
                      <div className="font-semibold tabular-nums text-zinc-900">{summary.actualBookedCount}</div>
                    </div>
                  </div>
                ) : null}

                {(summary.quotaRouteCount ?? 0) > 0 ? (
                  <div className={[
                    "grid grid-cols-[1fr_auto] items-center gap-2 rounded-sm px-1 py-0.5",
                    isUnderQuota ? "border border-red-300 bg-red-50/30" : "",
                  ].join(" ")}>
                    <span className="text-muted-foreground">Quota</span>
                    <span className="font-semibold tabular-nums">{summary.quotaRouteCount}</span>
                  </div>
                ) : null}

                {summary.offCount > 0 ? (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <span className="text-muted-foreground">Off</span>
                    <span className="font-semibold tabular-nums">{summary.offCount}</span>
                  </div>
                ) : null}

                {summary.callOutCount > 0 ? (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-sm bg-red-50 px-1 py-0.5">
                    <span className="font-medium text-red-600">No-show</span>
                    <span className="font-semibold tabular-nums text-red-600">{summary.callOutCount}</span>
                  </div>
                ) : null}

                {summary.addInCount > 0 ? (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <span className="text-muted-foreground">Add-in</span>
                    <span className="font-semibold tabular-nums">{summary.addInCount}</span>
                  </div>
                ) : null}

                {summary.bpLowCount > 0 ? (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <span className="text-amber-700">BP-low</span>
                    <span className="font-semibold tabular-nums text-amber-700">{summary.bpLowCount}</span>
                  </div>
                ) : null}

                {summary.techMoveCount > 0 ? (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <span className="text-muted-foreground">Moves</span>
                    <span className="font-semibold tabular-nums">{summary.techMoveCount}</span>
                  </div>
                ) : null}

                {summary.incidentCount > 0 ? (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <span className="text-orange-700">Incidents</span>
                    <span className="font-semibold tabular-nums text-orange-700">{summary.incidentCount}</span>
                  </div>
                ) : null}

                {summary.noteCount > 0 ? (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <span className="text-muted-foreground">Notes</span>
                    <span className="font-semibold tabular-nums">{summary.noteCount}</span>
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
