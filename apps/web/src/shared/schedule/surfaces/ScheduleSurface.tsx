// path: apps/web/src/shared/schedule/surfaces/ScheduleSurface.tsx

"use client";

import { useState } from "react";

import CreateExceptionModal from "@/features/route-lock/exceptions/components/CreateExceptionModal";

import ScheduleControlStrip from "../components/ScheduleControlStrip";
import ScheduleDayView from "./ScheduleDayView";
import ScheduleWeekView from "./ScheduleWeekView";
import ScheduleMonthView from "./ScheduleMonthView";

import type {
  ScheduleSurfacePayload,
} from "../types/scheduleSurfaceTypes";

type Props = {
  payload: ScheduleSurfacePayload;
  canSubmitExceptionRequest?: boolean;
};

export default function ScheduleSurface({
  payload,
  canSubmitExceptionRequest = false,
}: Props) {
  const [exceptionModalOpen, setExceptionModalOpen] =
    useState(false);

  return (
    <div className="space-y-2 overflow-hidden">

      <div className="flex flex-wrap items-center justify-between gap-3">

        <div className="text-lg font-semibold tracking-tight">
          Schedule
        </div>

        <div className="flex items-center gap-2">
          {canSubmitExceptionRequest ? (
            <button
              type="button"
              onClick={() => setExceptionModalOpen(true)}
              className="rounded-md border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/40"
            >
              Request Exception
            </button>
          ) : null}

          <div className="text-[11px] text-muted-foreground">
            {payload.rows.length} rows
          </div>
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

      {exceptionModalOpen ? (
        <CreateExceptionModal
          onClose={() => setExceptionModalOpen(false)}
          onCreated={() => window.location.reload()}
        />
      ) : null}

    </div>
  );
}
