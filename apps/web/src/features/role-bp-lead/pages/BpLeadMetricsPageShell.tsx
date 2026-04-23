// RUN THIS
// path: apps/web/src/features/role-bp-lead/pages/BpLeadMetricsPageShell.tsx

type Props = {
  range?: string;
  class_type: "NSR" | "SMART";
};

export default async function BpLeadMetricsPageShell(_props: Props) {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border bg-card p-6">
        <div className="text-sm font-medium">BP Lead Metrics</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Surface stub in place.
        </div>
      </div>
    </div>
  );
}