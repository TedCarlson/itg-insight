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
}) {
  const base = [
    "min-h-[210px] rounded-xl border bg-background p-3",
    args.isCurrentMonth ? "" : "opacity-45",
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
    <div className="space-y-3">
      <div className="sticky top-40 z-20 grid grid-cols-7 gap-2 bg-[var(--background)]/95 py-2 backdrop-blur">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="rounded-lg border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {dates.map((date) => {
          const summary = lookup.get(date) ?? emptySummary(date);
          const weekday = WEEKDAYS[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
          const isToday = date === today;
          const isCurrentMonth = date.slice(0, 7) === currentMonth;

          return (
            <Card
              key={date}
              className={cardClass({
                isToday,
                isFiscalMonthEnd: summary.isFiscalMonthEnd,
                isCurrentMonth,
              })}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {weekday}
                  </div>

                  {summary.fiscalAnchorLabel ? (
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      FM End
                    </div>
                  ) : null}
                </div>

                <div className="text-right">
                  <div className="text-lg font-semibold">
                    {Number(date.slice(8, 10))}
                  </div>

                  {isToday ? (
                    <div className="mt-1 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Today
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Scheduled
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {summary.scheduledCount}
                  </div>
                </div>

                <div className="rounded-lg border p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Off
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {summary.offCount}
                  </div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Call Outs
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {summary.callOutCount}
                  </div>
                </div>

                <div className="rounded-lg border p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Add Ins
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {summary.addInCount}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
