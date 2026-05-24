// path: apps/web/src/shared/schedule/components/ScheduleStatusPill.tsx

type Props = {
  label: string;
};

function getClasses(label: string) {
  switch (label) {

    case "CALL OUT":
      return "border-red-200 bg-red-50 text-red-700";

    case "ADD IN":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "MOVE":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-muted bg-muted/40 text-foreground";
  }
}

export default function ScheduleStatusPill({
  label,
}: Props) {

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        getClasses(label),
      ].join(" ")}
    >
      {label}
    </span>
  );
}
