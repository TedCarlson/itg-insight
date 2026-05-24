// path: apps/web/src/shared/schedule/components/ScheduleRouteLockCell.tsx

import type {
  ScheduleRouteLockFacts,
} from "../types/scheduleSurfaceTypes";

type Props = {
  routeLock: ScheduleRouteLockFacts;
};

export default function ScheduleRouteLockCell({
  routeLock,
}: Props) {

  const units =
    routeLock.actualUnits
    ?? routeLock.builtUnits
    ?? routeLock.plannedUnits;

  return (
    <div>
      <div className="font-medium">
        {units === null ? "—" : units}
      </div>

      <div className="text-xs text-muted-foreground">
        {routeLock.hasCheckIn
          ? "Check-in"
          : routeLock.hasShiftValidation
            ? "Shift validation"
            : "Planned"}
      </div>
    </div>
  );
}
