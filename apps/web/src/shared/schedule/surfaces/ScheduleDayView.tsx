// path: apps/web/src/shared/schedule/surfaces/ScheduleDayView.tsx

"use client";

import { Card } from "@/components/ui/Card";

import SchedulePhasePill from "../components/SchedulePhasePill";
import ScheduleStatusPill from "../components/ScheduleStatusPill";

import ScheduleDayStatsStrip from "./ScheduleDayStatsStrip";

import {
  buildDispatchBadges,
  sortRowsForDispatchFocus,
} from "../lib/dispatchScheduleSignals";

import type {
  ScheduleSurfacePayload,
  ScheduleSurfaceRow,
} from "../types/scheduleSurfaceTypes";

type Props = {
  payload: ScheduleSurfacePayload;
};

function formatHoursFromUnits(
  units: number,
) {
  const hours =
    units / 12;

  return Number.isInteger(hours)
    ? String(hours)
    : hours.toFixed(1);
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



export default function ScheduleDayView({
  payload,
}: Props) {

  const dayHasActuals =
    payload.rows.some((row) => row.routeLock.phase === "actual");

  return (
    <div className="space-y-4">
      <ScheduleDayStatsStrip rows={payload.rows} />

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="text-lg font-semibold">
            Daily Booking Ledger
          </div>

          <div className="text-sm text-[var(--muted-foreground)]">
            Coverage, route state, and dispatch context for the selected day
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs sm:text-sm lg:min-w-[980px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                  Tech
                </th>

                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                  Name
                </th>

                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                  Route
                </th>

                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                  Phase
                </th>

                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                  Units
                </th>

                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                  Dispatch / Notes
                </th>
              </tr>
            </thead>

            <tbody>
              {sortRowsForDispatchFocus(payload.rows).map((row) => {
                const dispatchBadges =
                  buildDispatchBadges(row);

                const units =
                  row.routeLock.actualUnits
                  ?? row.routeLock.builtUnits
                  ?? row.routeLock.plannedUnits
                  ?? null;

                const needsAttention =
                  needsActualAttention(row, dayHasActuals);

                return (
                  <tr
                    key={[
                      row.date,
                      row.personId,
                      row.assignmentId ?? "none",
                    ].join(":")}
                    className={[
                      "border-b border-[var(--border)] hover:bg-[var(--muted)]/20",
                      needsAttention ? "bg-amber-50/50" : "",
                    ].join(" ")}
                  >
                    <td className="whitespace-nowrap px-2 py-2 align-middle text-sm font-semibold">
                      {row.techId ?? "—"}
                    </td>

                    <td className="whitespace-nowrap px-2 py-2 align-middle text-sm">
                      {row.fullName}
                    </td>

                    <td className="whitespace-nowrap px-2 py-2 align-middle text-sm font-semibold">
                      {row.baseSchedule.routeArea ?? "No booked route"}
                    </td>

                    <td className="whitespace-nowrap px-2 py-2 align-middle">
                      <div className="flex items-center gap-1.5">
                        <SchedulePhasePill phase={row.routeLock.phase} />

                        {needsAttention ? (
                          <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            Missing Actual
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-2 py-2 align-middle text-sm">
                      {units == null ? (
                        <span className="text-[var(--muted-foreground)]">—</span>
                      ) : (
                        <span>
                          <span className="font-semibold">{units}</span>
                          <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                            [{formatHoursFromUnits(units)}h]
                          </span>
                        </span>
                      )}
                    </td>

                    <td className="px-2 py-2 align-middle">
                      {dispatchBadges.length > 0 || row.dispatch.latestNote ? (
                        <div className="flex min-w-[280px] flex-wrap items-center gap-1.5">
                          {dispatchBadges.map((badge) => (
                            <ScheduleStatusPill
                              key={badge}
                              label={badge}
                            />
                          ))}

                          {row.dispatch.latestNote ? (
                            <span className="max-w-[520px] truncate text-xs text-[var(--muted-foreground)]">
                              {row.dispatch.latestNote}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--muted-foreground)]">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
