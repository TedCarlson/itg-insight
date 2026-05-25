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
    <div className="space-y-2 overflow-hidden">

      <div className="flex flex-wrap items-center justify-between gap-3">

        <div className="text-lg font-semibold tracking-tight">
          Schedule
        </div>

        <div className="text-[11px] text-muted-foreground">
          {payload.rows.length} rows
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
