// path: apps/web/src/shared/schedule/surfaces/ScheduleWeekView.tsx

"use client";

import { Card } from "@/components/ui/Card";

import type {
  ScheduleDailySummary,
  ScheduleSurfacePayload,
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

function weekdayLabel(
  date: string,
) {
  const d =
    new Date(`${date}T00:00:00`);

  return WEEKDAY_LABELS[d.getDay()];
}

function shortDate(
  date: string,
) {
  const d =
    new Date(`${date}T00:00:00`);

  return d.getDate();
}

function isFiscalMonthEnd(
  date: string,
) {
  return date.endsWith("-21");
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

      <div className="sticky top-40 z-20 grid grid-cols-7 gap-3 bg-[var(--background)]/95 py-2 backdrop-blur">

        {summaries.map((summary) => (
          <div
            key={`${summary.date}:header`}
            className="rounded-lg border bg-muted/20 px-3 py-2"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {weekdayLabel(summary.date)}
            </div>
          </div>
        ))}

      </div>

      <div className="grid grid-cols-7 gap-3">

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
                "min-h-[720px]",
                isToday
                  ? "border-2 border-blue-500 bg-blue-50/20"
                  : "",
                isFmEnd
                  ? "border-2 border-amber-500"
                  : "",
              ].join(" ")}
            >
              <div className="border-b border-[var(--border)] px-4 py-3">

                <div className="flex items-start justify-between gap-2">

                  <div className="text-3xl font-semibold tracking-tight">
                    {shortDate(summary.date)}
                  </div>

                  <div className="flex flex-col items-end gap-1">

                    {isToday ? (
                      <div className="rounded-full bg-blue-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Today
                      </div>
                    ) : null}

                    {isFmEnd ? (
                      <div className="rounded-full bg-amber-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                        FM End
                      </div>
                    ) : null}

                  </div>

                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {summary.scheduledCount} scheduled
                </div>

              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-[var(--border)] p-3">

                <div className="rounded-lg border p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Call Outs
                  </div>

                  <div className="mt-1 text-xl font-semibold">
                    {summary.callOutCount}
                  </div>
                </div>

                <div className="rounded-lg border p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Add Ins
                  </div>

                  <div className="mt-1 text-xl font-semibold">
                    {summary.addInCount}
                  </div>
                </div>

              </div>

              <div className="space-y-2 p-3">

                {rowsForDate.map((row) => (
                  <div
                    key={`${row.personId}:${row.date}`}
                    className="rounded-lg border border-[var(--border)] bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-2">

                      <div className="text-base font-semibold">
                        {row.techId ?? "—"}
                      </div>

                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {row.baseSchedule.routeArea ?? "OFF"}
                      </div>

                    </div>

                    <div className="mt-1 text-sm leading-snug">
                      {row.fullName}
                    </div>

                  </div>
                ))}

              </div>

            </Card>
          );
        })}

      </div>

    </div>
  );
}
