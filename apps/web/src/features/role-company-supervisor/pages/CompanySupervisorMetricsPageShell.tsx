// Path: apps/web/src/features/role-copmany-supervisor/pages/CompanySupervisorMetricsPageShell.tsx

import CompanySupervisorScopedViewClient from "../components/CompanySupervisorScopedViewClient";
import { getCompanySupervisorSurfacePayload } from "../lib/getCompanySupervisorSurfacePayload.server";

type ReportClassType = "NSR" | "SMART";
type MetricsRangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

type Props = {
  range?: string;
  class_type: ReportClassType;
};

function normalizeRangeKey(value: string | undefined): MetricsRangeKey {
  const upper = String(value ?? "FM").toUpperCase();
  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
}

export default async function CompanySupervisorMetricsPageShell(props: Props) {
  const range = normalizeRangeKey(props.range);

  const payload = await getCompanySupervisorSurfacePayload({
    profile_key: props.class_type,
    range,
  });

  return (
    <div className="space-y-4 p-4">
      <CompanySupervisorScopedViewClient
        payload={payload}
        classType={props.class_type}
      />
    </div>
  );
}