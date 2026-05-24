// path: apps/web/src/shared/schedule/components/SchedulePhasePill.tsx

import type {
  SchedulePhase,
} from "../types/scheduleSurfaceTypes";

type Props = {
  phase: SchedulePhase;
};

function getClasses(
  phase: SchedulePhase,
) {
  switch (phase) {

    case "planned":
      return "border-sky-200 bg-sky-50 text-sky-700";

    case "built":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "actual":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    default:
      return "border-muted bg-muted/40 text-foreground";
  }
}

export default function SchedulePhasePill({
  phase,
}: Props) {

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        getClasses(phase),
      ].join(" ")}
    >
      {phase}
    </span>
  );
}
