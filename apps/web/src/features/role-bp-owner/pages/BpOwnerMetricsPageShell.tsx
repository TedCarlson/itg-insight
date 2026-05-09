// path: apps/web/src/features/role-bp-owner/pages/BpOwnerMetricsPageShell.tsx

import getBpOwnerSurfacePayload from "../lib/getBpOwnerSurfacePayload.server";
import BpSupervisorScopedViewClient from "@/features/role-bp-supervisor/components/BpSupervisorScopedViewClient";

type Props = {
  range?: string;
  class_type: "NSR" | "SMART";
};

export default async function BpOwnerMetricsPageShell(props: Props) {
  const payload = await getBpOwnerSurfacePayload({
    profile_key: props.class_type,
    range: props.range,
  });

  return (
    <div className="space-y-4 p-4">
      <div id="shell-role-hint" data-shell-role="BP_OWNER" className="hidden" />
      <BpSupervisorScopedViewClient payload={payload} />
    </div>
  );
}