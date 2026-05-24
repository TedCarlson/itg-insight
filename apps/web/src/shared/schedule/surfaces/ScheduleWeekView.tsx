// path: apps/web/src/shared/schedule/surfaces/ScheduleWeekView.tsx

"use client";

import { Card } from "@/components/ui/Card";

import type {
  ScheduleDailySummary,
  ScheduleSurfacePayload,
  ScheduleSurfaceRow,
} from "../types/scheduleSurfaceTypes";

type Props = {
  payload: ScheduleSurfacePayload;
};

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function weekdayLabel(date: string) {
  return WEEKDAY_LABELS[new Date(`${date}T00:00:00`).getDay()];
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).getDate();
}

function isFiscalMonthEnd(date: string) {
  return date.endsWith("-21");
}

function formatHoursFromUnits(units: number | null) {
  if (units == null) return null;

  const hours = units / 12;

  return Number.isInteger(hours)
    ? String(hours)
    : hours.toFixed(1);
}

function rowUnits(row: ScheduleSurfaceRow) {
  return (
    row.routeLock.actualUnits ??
    row.routeLock.builtUnits ??
    row.routeLock.plannedUnits ??
    null
  );
}

function phaseShort(row: ScheduleSurfaceRow) {
  if (row.routeLock.phase === "actual") return "ACT";
  if (row.routeLock.phase === "built") return "BLD";
  return "PLN";
}

function cardTone(args: {
  isToday: boolean;
  isFmEnd: boolean;
}) {
  if (args.isToday) {
    return "border-2 border-blue-500 bg-blue-50/20";
  }

  if (args.isFmEnd) {
    return "border-2 border-amber-500";
  }

  return "";
}

export default function ScheduleWeekView({
  payload,
}: Props) {
  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const summaries =
    payload.dailySummaries
      .slice()
      .sort((a, b) =>
        a.date.localeCompare(b.date),
      );

  return (
    <div className="space-y-3">

      <div className="sticky top-40 z-20 grid grid-cols-7 gap-1.5 bg-[var(--background)]/95 py-2 backdrop-blur">
        {summaries.map((summary) => (
          <div
            key={`${summary.date}:header`}
            className="rounded-lg border bg-muted/20 px-2.5 py-2"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {weekdayLabel(summary.date)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {summaries.map((
          summary: ScheduleDailySummary,
        ) => {
          const rowsForDate =
            payload.rows.filter((row) => row.date === summary.date);

          const isToday =
            summary.date === today;

          const isFmEnd =
            isFiscalMonthEnd(summary.date);

          return (
            <Card
              key={summary.date}
              className={[
                "flex h-[720px] min-h-0 flex-col overflow-hidden",
                cardTone({
                  isToday,
                  isFmEnd,
                }),
              ].join(" ")}
            >
              <div className="border-b border-[var(--border)] px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-semibold tracking-tight">
                      {shortDate(summary.date)}
                    </div>

                    {isToday ? (
                      <div className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Today
                      </div>
                    ) : null}

                    {isFmEnd ? (
                      <div className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        FM End
                      </div>
                    ) : null}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {summary.scheduledCount} booked
                  </div>
                </div>

                <div className="mt-1 flex items-center gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-red-600">
                      {summary.callOutCount}
                    </span>
                    {" "}
                    <span className="text-muted-foreground">
                      no-show
                    </span>
                  </div>

                  <div className="h-3 w-px bg-[var(--border)]" />

                  <div>
                    <span className="font-semibold">
                      {summary.addInCount}
                    </span>
                    {" "}
                    <span className="text-muted-foreground">
                      add-in
                    </span>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
                <div className="space-y-1">
                  {rowsForDate.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-2 py-2 text-xs text-muted-foreground">
                      No booked work
                    </div>
                  ) : (
                    rowsForDate.map((row, index) => {
                      const units =
                        rowUnits(row);

                      const openAbove =
                        index >= Math.max(0, rowsForDate.length - 6);

                      const hours =
                        formatHoursFromUnits(units);

                      return (
                        <div
                          key={`${row.personId}:${row.assignmentId ?? "none"}:${row.date}`}
                          className="group relative rounded-md border border-[var(--border)] bg-background px-1.5 py-1 text-xs"
                        >
                          <div className="truncate text-center font-semibold tabular-nums">
                            {row.techId ?? "—"}
                          </div>

                          <div
                            className={[
                              "pointer-events-none absolute left-0 right-0 z-40 hidden rounded-lg border bg-background p-2 text-center shadow-lg group-hover:block group-focus-within:block",
                              openAbove
                                ? "bottom-full mb-1"
                                : "top-full mt-1",
                            ].join(" ")}
                          >
                            <div className="break-words text-xs font-semibold leading-snug">
                              {row.fullName}
                            </div>

                            <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                              <div className="font-medium text-foreground">
                                {row.baseSchedule.routeArea ?? "OFF"}
                              </div>

                              <div className="font-medium text-foreground">
                                {phaseShort(row)}
                              </div>

                              <div className="font-medium text-foreground">
                                {units != null ? `${units}u` : "—"}
                                {hours ? ` [${hours}h]` : ""}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
