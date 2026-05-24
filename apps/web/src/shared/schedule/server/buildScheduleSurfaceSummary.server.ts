// path: apps/web/src/shared/schedule/server/buildScheduleSurfaceSummary.server.ts

import type {
  ScheduleSurfaceRow,
  ScheduleSurfaceSummary,
} from "../types/scheduleSurfaceTypes";

export function buildScheduleSurfaceSummary(
  rows: ScheduleSurfaceRow[],
): ScheduleSurfaceSummary {

  return rows.reduce<ScheduleSurfaceSummary>(
    (summary, row) => {

      if (row.baseSchedule.scheduled) {
        summary.scheduledCount += 1;
      } else {
        summary.offCount += 1;
      }

      if (row.dispatch.callOut) {
        summary.callOutCount += 1;
      }

      if (row.dispatch.addIn) {
        summary.addInCount += 1;
      }

      if (row.dispatch.techMove) {
        summary.techMoveCount += 1;
      }

      return summary;
    },
    {
      scheduledCount: 0,
      offCount: 0,
      callOutCount: 0,
      addInCount: 0,
      techMoveCount: 0,
    },
  );
}
