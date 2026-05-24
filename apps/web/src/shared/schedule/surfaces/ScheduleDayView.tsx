// path: apps/web/src/shared/schedule/surfaces/ScheduleDayView.tsx

"use client";

import { Card } from "@/components/ui/Card";

import SchedulePhasePill from "../components/SchedulePhasePill";
import ScheduleStatusPill from "../components/ScheduleStatusPill";

import ScheduleDayStatsStrip from "./ScheduleDayStatsStrip";

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

function buildDispatchBadges(
  row: ScheduleSurfaceRow,
) {
  const badges: string[] = [];

  if (row.dispatch.callOut) {
    badges.push("Coverage Gap");
  }

  if (row.dispatch.addIn) {
    badges.push("Add-In");
  }

  if (row.dispatch.techMove) {
    badges.push("Move");
  }

  if (row.dispatch.incidentCount > 0) {
    badges.push("Incident");
  }

  if (row.dispatch.noteCount > 0) {
    badges.push("Note");
  }

  return badges;
}

export default function ScheduleDayView({
  payload,
}: Props) {

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

        <table className="w-full min-w-[1050px] border-collapse">

          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Tech
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Name
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Coverage / Booking Status
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Dispatch / Notes
              </th>
            </tr>
          </thead>

          <tbody>
            {payload.rows.map((row) => {

              const dispatchBadges =
                buildDispatchBadges(row);

              return (
                <tr
                  key={[
                    row.date,
                    row.personId,
                    row.assignmentId ?? "none",
                  ].join(":")}
                  className="border-b border-[var(--border)]"
                >
                  <td className="px-4 py-4 align-top text-sm font-semibold">
                    {row.techId ?? "—"}
                  </td>

                  <td className="px-4 py-4 align-top text-sm">
                    {row.fullName}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="space-y-2">

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold">
                          {row.baseSchedule.routeArea ?? "No booked route"}
                        </div>

                        <SchedulePhasePill
                          phase={row.routeLock.phase}
                        />
                      </div>

                      <div className="grid gap-1 text-xs text-[var(--muted-foreground)]">

                        <div>
                          Planned route:
                          {" "}
                          <span className="font-medium text-foreground">
                            {row.baseSchedule.routeArea ?? "—"}
                          </span>
                        </div>

                        <div>
                          Units:
                          {" "}
                          {(() => {
                            const units =
                              row.routeLock.actualUnits
                              ?? row.routeLock.builtUnits
                              ?? row.routeLock.plannedUnits
                              ?? null;

                            if (units == null) {
                              return (
                                <span className="font-medium text-foreground">
                                  —
                                </span>
                              );
                            }

                            return (
                              <span className="font-medium text-foreground">
                                {units}
                                {" "}
                                <span className="text-[var(--muted-foreground)]">
                                  [{formatHoursFromUnits(units)} hours]
                                </span>
                              </span>
                            );
                          })()}
                        </div>

                      </div>

                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    {dispatchBadges.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {dispatchBadges.map((badge) => (
                            <ScheduleStatusPill
                              key={badge}
                              label={badge}
                            />
                          ))}
                        </div>

                        {row.dispatch.latestNote ? (
                          <div className="max-w-[360px] text-xs leading-snug text-[var(--muted-foreground)]">
                            {row.dispatch.latestNote}
                          </div>
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
