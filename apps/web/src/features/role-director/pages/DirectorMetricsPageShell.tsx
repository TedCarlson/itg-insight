// path: apps/web/src/features/role-director/pages/DirectorMetricsPageShell.tsx

import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/ui/PageShell";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import CompanyManagerScopedViewClient from "@/features/role-company-manager/components/CompanyManagerScopedViewClient";
import { buildMetricsSurfacePayload } from "@/shared/server/metrics/buildMetricsSurfacePayload.server";
import { loadWorkforceSourceRows } from "@/shared/server/workforce/loadWorkforceSourceRows.server";
import { DirectorWorkspaceSelector } from "@/shared/surfaces/navigation/DirectorWorkspaceSelector";
import type { MetricsRangeKey } from "@/shared/types/metrics/surfacePayload";

type ReportClassType = "NSR" | "SMART";

type Props = {
  range?: string;
  class_type: ReportClassType;
};

function normalizeRangeKey(value: string | undefined): MetricsRangeKey {
  const upper = String(value ?? "FM").trim().toUpperCase();

  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";

  return "FM";
}

function toProfileKey(classType: ReportClassType): "NSR" | "SMART" {
  return classType === "SMART" ? "SMART" : "NSR";
}

export default async function DirectorMetricsPageShell(props: Props) {
  const range = normalizeRangeKey(props.range);
  const scope = await requireSelectedPcOrgServer();

  if (!scope.ok) {
    return (
      <PageShell>
        <DirectorWorkspaceSelector />

        <Card className="p-4">
          <div className="text-sm font-medium">No selected organization</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Select an organization to load the Director Metrics workspace.
          </div>
        </Card>
      </PageShell>
    );
  }

  const workforceRows = await loadWorkforceSourceRows({
    pc_org_id: scope.selected_pc_org_id,
    as_of_date: new Date().toISOString().slice(0, 10),
  });

  const scopedTechIds = Array.from(
    new Set(
      workforceRows
        .filter((row) => row.is_active)
        .filter((row) => row.is_field || row.is_travel_tech)
        .filter((row) => String(row.role_type ?? "").trim().toUpperCase() !== "TRAINING")
        .map((row) => String(row.tech_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const payload = await buildMetricsSurfacePayload({
    role_key: "DIRECTOR",
    profile_key: toProfileKey(props.class_type),
    pc_org_id: scope.selected_pc_org_id,
    range,
    scoped_tech_ids: scopedTechIds,
    role_label: "Director",
    rep_full_name: null,
    visibility: {
      show_jobs: false,
      show_risk: true,
      show_work_mix: false,
      show_parity: false,
    },
  });

  return (
    <PageShell>
      <DirectorWorkspaceSelector />

      <div className="space-y-4">
        <CompanyManagerScopedViewClient payload={payload} />
      </div>
    </PageShell>
  );
}