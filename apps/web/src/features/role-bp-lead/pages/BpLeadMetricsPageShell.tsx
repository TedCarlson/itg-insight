// path: apps/web/src/features/role-bp-lead/pages/BpLeadMetricsPageShell.tsx

import getBpLeadExecutiveMetricsPayload from "../lib/getBpLeadExecutiveMetricsPayload.server";
import BpSupervisorScopedViewClient from "@/features/role-bp-supervisor/components/BpSupervisorScopedViewClient";

type Props = {
  range?: string;
  class_type?: "NSR" | "SMART";
};

export default async function BpLeadMetricsPageShell(props: Props) {
  const payload = await getBpLeadExecutiveMetricsPayload({
    profile_key: props.class_type ?? "NSR",
    range: (props.range ?? "FM") as any,
  });

  return (
    <div className="space-y-4 p-4">
      <div id="shell-role-hint" data-shell-role="BP_LEAD" className="hidden" />
      <BpSupervisorScopedViewClient payload={payload} />
    </div>
  );
}