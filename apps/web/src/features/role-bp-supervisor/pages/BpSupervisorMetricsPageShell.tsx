import getBpSupervisorSurfacePayload from "@/features/role-bp-supervisor/lib/getBpSupervisorSurfacePayload.server";
import BpSupervisorScopedViewClient from "@/features/role-bp-supervisor/components/BpSupervisorScopedViewClient";

type Props = {
  class_type: "NSR" | "SMART";
  range?: string;
};

export default async function BpSupervisorMetricsPageShell({
  class_type,
  range,
}: Props) {
  const payload = await getBpSupervisorSurfacePayload({
    profile_key: class_type,
    range,
  });

  return <BpSupervisorScopedViewClient payload={payload} />;
}