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

function missingActualCountForDate(
  payload: ScheduleSurfacePayload,
  date: string,
) {
  const rowsForDate =
    payload.rows.filter((row) => row.date === date);

  const dayHasActuals =
    rowsForDate.some((row) => row.routeLock.phase === "actual");

  if (!dayHasActuals) {
    return 0;
  }

  return rowsForDate.filter((row) => {
    const hasDispatchExplanation =
      row.dispatch.callOut ||
      row.dispatch.addIn ||
      row.dispatch.techMove ||
      row.dispatch.incidentCount > 0 ||
      row.dispatch.noteCount > 0 ||
      Boolean(String(row.dispatch.latestNote ?? "").trim());

    return (
      row.routeLock.phase === "built" &&
      !row.routeLock.hasCheckIn &&
      !hasDispatchExplanation
    );
  }).length;
}

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
  const out = new Map<string, ScheduleDailySummary>();

  for (const summary of summaries) {
    out.set(summary.date, summary);
  }

  return out;
}

function emptySummary(date: string): ScheduleDailySummary {
  return {
    date,
    scheduledCount: 0,
    offCount: 0,
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

function cardClass(args: {
  isToday: boolean;
  isFiscalMonthEnd: boolean;
  isCurrentMonth: boolean;
  isBlackout: boolean;
}) {
  const base = [
    "min-h-[112px] rounded-lg border bg-background px-2 py-2",
    args.isCurrentMonth ? "" : "opacity-40",
    args.isBlackout ? "bg-zinc-950/[0.035] shadow-[inset_0_0_0_9999px_rgba(113,113,122,0.035)]" : "",
  ];

  if (args.isToday) {
    base.push("border-2 border-blue-500 bg-blue-50/30 shadow-sm");
  } else if (args.isFiscalMonthEnd) {
    base.push("border-2 border-amber-400 bg-amber-50/20");
  }

  return base.filter(Boolean).join(" ");
}

export default function ScheduleMonthView({
  payload,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const lookup = summaryByDate(payload.dailySummaries);
  const dates = buildCalendarDates(
    payload.filters.startDate,
    payload.filters.endDate,
  );

  const currentMonth = payload.filters.startDate.slice(0, 7);

  return (
    <div className="space-y-2">
      <div className="grid auto-cols-[minmax(190px,1fr)] grid-flow-col gap-1.5 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-7 xl:overflow-visible xl:pb-0">
        {dates.map((date) => {
          const summary = lookup.get(date) ?? emptySummary(date);
          const weekday = WEEKDAYS[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
          const isToday = date === today;
          const isCurrentMonth = date.slice(0, 7) === currentMonth;
          const blackoutDay =
            payload.blackoutByDate?.[date] ?? null;
          const blackoutLabel =
            blackoutDay?.rules?.[0]?.label ?? null;
          const isBlackout =
            Boolean(blackoutDay?.rules?.length);

          const missingActualCount =
            missingActualCountForDate(payload, date);

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
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {weekday}
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {summary.fiscalAnchorLabel ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        FM End
                      </span>
                    ) : null}

                    {isBlackout ? (
                      <span
                        title={blackoutLabel ?? "Blackout"}
                        className="rounded-sm border border-zinc-300 bg-zinc-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-700"
                      >
                        Blackout
                      </span>
                    ) : null}

                    {missingActualCount > 0 ? (
                      <span
                        title="Built rows missing actual check-in"
                        className="rounded-sm border border-amber-300 bg-amber-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-amber-800"
                      >
                        Missing Actual {missingActualCount}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-right">
                  {isToday ? (
                    <div className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                      Today
                    </div>
                  ) : null}

                  <div className="text-lg font-semibold leading-none">
                    {Number(date.slice(8, 10))}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-1 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Booked</span>
                  <span className="font-semibold tabular-nums">{summary.scheduledCount}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Off</span>
                  <span className="font-semibold tabular-nums">{summary.offCount}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">No-show</span>
                  <span className="font-semibold tabular-nums text-red-600">{summary.callOutCount}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Add-in</span>
                  <span className="font-semibold tabular-nums">{summary.addInCount}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">BP-low</span>
                  <span className="font-semibold tabular-nums">{summary.bpLowCount}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
