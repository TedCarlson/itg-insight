// path: apps/web/src/shared/schedule/surfaces/ScheduleSurface.tsx

"use client";

import ScheduleControlStrip from "../components/ScheduleControlStrip";
import ScheduleDayView from "./ScheduleDayView";
import ScheduleWeekView from "./ScheduleWeekView";
import ScheduleMonthView from "./ScheduleMonthView";

import type {
  ScheduleSurfacePayload,
} from "../types/scheduleSurfaceTypes";

type Props = {
  payload: ScheduleSurfacePayload;
};

export default function ScheduleSurface({
  payload,
}: Props) {

  return (
    <div className="space-y-4">

      <div className="flex items-start justify-between gap-4">

        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Schedule
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Shared read-only booking visibility surface
          </p>
        </div>

        <div className="pt-2 text-xs text-muted-foreground">
          Rows: {payload.rows.length}
        </div>

      </div>

      <ScheduleControlStrip
        filters={payload.filters}
      />

      {payload.filters.viewMode === "day" ? (
        <ScheduleDayView
          payload={payload}
        />
      ) : null}

      {payload.filters.viewMode === "week" ? (
        <ScheduleWeekView
          payload={payload}
        />
      ) : null}

      {payload.filters.viewMode === "month" ? (
        <ScheduleMonthView
          payload={payload}
        />
      ) : null}

    </div>
  );
}
