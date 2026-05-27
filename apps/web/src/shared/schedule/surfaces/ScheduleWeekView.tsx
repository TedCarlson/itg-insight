// path: apps/web/src/shared/schedule/surfaces/ScheduleWeekView.tsx

"use client";

import { Card } from "@/components/ui/Card";

import {
  buildDispatchBadges,
  sortRowsForDispatchFocus,
} from "../lib/dispatchScheduleSignals";

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


function needsActualAttention(
  row: ScheduleSurfaceRow,
  dayHasActuals: boolean,
) {
  const hasDispatchExplanation =
    row.dispatch.callOut ||
    row.dispatch.addIn ||
    row.dispatch.techMove ||
    row.dispatch.bpLow ||
    row.dispatch.incidentCount > 0 ||
    row.dispatch.noteCount > 0 ||
    Boolean(String(row.dispatch.latestNote ?? "").trim());

  return (
    dayHasActuals &&
    row.routeLock.phase === "built" &&
    !row.routeLock.hasCheckIn &&
    !hasDispatchExplanation
  );
}


function phaseShort(row: ScheduleSurfaceRow) {
  if (row.routeLock.phase === "actual") return "ACT";
  if (row.routeLock.phase === "built") return "BLD";
  return "PLN";
}

function techCardTone(row: ScheduleSurfaceRow) {
  if (row.dispatch.callOut) {
    return "border-red-300 bg-red-50/40 text-red-950";
  }

  if (row.routeLock.phase === "actual") {
    return "border-emerald-300 bg-emerald-50/50";
  }

  if (row.routeLock.phase === "built") {
    return "border-violet-300 bg-violet-50/50";
  }

  return "border-[var(--border)] bg-background";
}

function cardTone(args: {
  isToday: boolean;
  isFmEnd: boolean;
  isBlackout: boolean;
}) {
  if (args.isToday) {
    return args.isBlackout
      ? "border-2 border-blue-500 bg-blue-50/10 shadow-[inset_0_0_0_9999px_rgba(113,113,122,0.035)]"
      : "border-2 border-blue-500 bg-blue-50/10";
  }

  if (args.isBlackout) {
    return "bg-zinc-950/[0.035] shadow-[inset_0_0_0_9999px_rgba(113,113,122,0.035)]";
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

      <div className="grid auto-cols-[minmax(260px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-2 2xl:grid-flow-row 2xl:grid-cols-7 2xl:overflow-visible 2xl:pb-0">
        {summaries.map((
          summary: ScheduleDailySummary,
        ) => {
          const rowsForDate =
            sortRowsForDispatchFocus(
              payload.rows.filter((row) => row.date === summary.date),
            );

          const dayHasActuals =
            rowsForDate.some((row) => row.routeLock.phase === "actual");

          const isToday =
            summary.date === today;

          const isFmEnd =
            isFiscalMonthEnd(summary.date);

          const blackoutDay =
            payload.blackoutByDate?.[summary.date] ?? null;

          const blackoutLabel =
            blackoutDay?.rules?.[0]?.label ?? null;

          const isBlackout =
            Boolean(blackoutDay?.rules?.length);

          return (
            <Card
              key={summary.date}
              className={[
                "flex h-[620px] min-h-0 flex-col overflow-hidden 2xl:h-[720px]",
                cardTone({
                  isToday,
                  isFmEnd,
                  isBlackout,
                }),
              ].join(" ")}
            >
              <div className="border-b border-[var(--border)] px-2.5 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {weekdayLabel(summary.date)}
                    </div>

                    <div className="mt-0.5 flex items-center gap-2">
                      <div className="text-2xl font-semibold tracking-tight">
                        {shortDate(summary.date)}
                      </div>

                    {isFmEnd ? (
                      <div className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        FM End
                      </div>
                    ) : null}

                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1 pt-1 text-xs text-muted-foreground">
                    {isBlackout ? (
                      <div
                        title={blackoutLabel ?? "Blackout"}
                        className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700"
                      >
                        Blackout
                      </div>
                    ) : null}

                    <div>
                      {summary.actualBookedCount > 0
                        ? `${summary.actualBookedCount} actual`
                        : summary.builtBookedCount > 0
                          ? `${summary.builtBookedCount} built`
                          : `${summary.plannedBookedCount} planned`}
                    </div>
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
                      {isBlackout ? (blackoutLabel ?? "Blackout") : "No booked work"}
                    </div>
                  ) : (
                    rowsForDate.map((row, index) => {
                      const units =
                        rowUnits(row);

                      const openAbove =
                        index >= Math.max(0, rowsForDate.length - 6);

                      const hours =
                        formatHoursFromUnits(units);

                      const needsAttention =
                        needsActualAttention(row, dayHasActuals);

                      return (
                        <div
                          key={`${row.personId}:${row.assignmentId ?? "none"}:${row.date}`}
                          className={[
                            "group relative rounded-md border px-1.5 py-1 text-xs",
                            techCardTone(row),
                            needsAttention ? "ring-1 ring-amber-300 bg-amber-50/70" : "",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-center gap-1 truncate text-center font-semibold tabular-nums">
                            <span>
                              {row.techId ?? "—"}
                            </span>

                            {row.affiliationCode ? (
                              <span
                                title={[
                                  row.affiliationCode,
                                  row.contractorName,
                                  row.affiliationName,
                                ].filter(Boolean).join(" • ")}
                                className="rounded-sm bg-muted px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
                              >
                                {row.affiliationCode}
                              </span>
                            ) : null}

                            {row.dispatch.callOut ? (
                              <span className="rounded-sm bg-red-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-red-700">
                                NS
                              </span>
                            ) : null}

                            {row.dispatch.addIn ? (
                              <span className="rounded-sm bg-emerald-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                                ADD
                              </span>
                            ) : null}

                            {row.dispatch.incidentCount > 0 ? (
                              <span className="rounded-sm bg-orange-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-orange-700">
                                INC
                              </span>
                            ) : null}

                            {row.dispatch.bpLow ? (
                              <span className="rounded-sm bg-amber-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                                BPL
                              </span>
                            ) : null}

                            {row.dispatch.techMove ? (
                              <span className="rounded-sm bg-sky-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-sky-700">
                                MOV
                              </span>
                            ) : null}

                            {row.dispatch.noteCount > 0 ? (
                              <span className="rounded-sm bg-zinc-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-700">
                                N
                              </span>
                            ) : null}

                            {needsAttention ? (
                              <span
                                title="Missing Actual"
                                className="rounded-sm bg-amber-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-amber-800"
                              >
                                MISS
                              </span>
                            ) : null}
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

                              {needsAttention ? (
                                <div className="font-semibold text-amber-800">
                                  Missing Actual
                                </div>
                              ) : null}

                              <div className="font-medium text-foreground">
                                {units != null ? `${units}u` : "—"}
                                {hours ? ` [${hours}h]` : ""}
                              </div>

                              {buildDispatchBadges(row).length ? (
                                <div className="pt-1">
                                  <div className="font-semibold uppercase tracking-wide text-foreground">
                                    Dispatch
                                  </div>

                                  <div className="mt-1 flex flex-wrap justify-center gap-1">
                                    {buildDispatchBadges(row).map((badge) => (
                                      <span
                                        key={badge}
                                        className="rounded-full border px-1.5 py-0.5 text-[10px]"
                                      >
                                        {badge}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {row.dispatch.latestNote ? (
                                <div className="pt-1 text-[10px] leading-snug text-foreground">
                                  {row.dispatch.latestNote}
                                </div>
                              ) : null}
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
