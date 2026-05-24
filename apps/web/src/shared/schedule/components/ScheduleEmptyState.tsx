// path: apps/web/src/shared/schedule/components/ScheduleEmptyState.tsx

type Props = {
  title?: string;
  message?: string;
};

export default function ScheduleEmptyState({
  title = "No schedule rows found",
  message = "Schedule data will appear here once the scoped payload is hydrated.",
}: Props) {
  return (
    <div className="rounded-xl border border-dashed bg-background p-6 text-center">
      <div className="text-sm font-medium">
        {title}
      </div>

      <div className="mt-2 text-sm text-muted-foreground">
        {message}
      </div>
    </div>
  );
}
