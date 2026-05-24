// path: apps/web/src/shared/schedule/components/ScheduleRouteCell.tsx

import type {
  ScheduleBaseSchedule,
} from "../types/scheduleSurfaceTypes";

type Props = {
  baseSchedule: ScheduleBaseSchedule;
};

export default function ScheduleRouteCell({
  baseSchedule,
}: Props) {

  if (!baseSchedule.scheduled) {
    return (
      <span className="text-muted-foreground">
        Off / Not scheduled
      </span>
    );
  }

  return (
    <div>
      <div className="font-medium">
        {baseSchedule.routeArea ?? "Scheduled"}
      </div>

      <div className="text-xs text-muted-foreground">
        {baseSchedule.source}
      </div>
    </div>
  );
}
