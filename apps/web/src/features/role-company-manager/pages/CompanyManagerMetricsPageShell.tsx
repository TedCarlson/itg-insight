// path: apps/web/src/features/role-company-manager/pages/CompanyManagerMetricsPageShell.tsx

import CompanyManagerScopedViewClient from "../components/CompanyManagerScopedViewClient";
import { getCompanyManagerSurfacePayload } from "../lib/getCompanyManagerSurfacePayload.server";

type ReportClassType = "NSR" | "SMART";
type MetricsRangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

type Props = {
  range?: string;
  class_type: ReportClassType;
};

function toProfileKey(classType: ReportClassType): "NSR" | "SMART" {
  return classType === "SMART" ? "SMART" : "NSR";
}

function normalizeRangeKey(value: string | undefined): MetricsRangeKey {
  const upper = String(value ?? "FM").trim().toUpperCase();
  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
}

export default async function CompanyManagerMetricsPageShell(props: Props) {
  const range = normalizeRangeKey(props.range);

  const payload = await getCompanyManagerSurfacePayload({
    profile_key: toProfileKey(props.class_type),
    range,
  });

  return (
    <div className="space-y-4 p-4">
      <CompanyManagerScopedViewClient payload={payload} />
    </div>
  );
}