// path: apps/web/src/features/role-bp-owner/pages/BpOwnerMetricsPageShell.tsx

type Props = {
  range?: string;
  class_type: "NSR" | "SMART";
};

export default async function BpOwnerMetricsPageShell(_props: Props) {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border bg-card p-6">
        <div className="text-sm font-medium">BP Owner Metrics</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Surface stub in place.
        </div>
      </div>
    </div>
  );
}