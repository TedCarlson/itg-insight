// path: apps/web/src/features/role-director/pages/DirectorWorkspacePageShell.tsx

import { PageShell } from "@/components/ui/PageShell";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { DirectorWorkspaceSelector } from "@/shared/surfaces/navigation/DirectorWorkspaceSelector";
import { buildWorkforceSurfacePayload } from "@/shared/server/workforce/buildWorkforceSurfacePayload.server";
import { loadWorkforceSourceRows } from "@/shared/server/workforce/loadWorkforceSourceRows.server";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";
import type { WorkforceRow } from "@/shared/types/workforce/workforce.types";
import { DirectorExecutiveWorkforceCard } from "@/shared/executive/DirectorExecutiveWorkforceCard";
import { buildWorkforceExecutiveDimension } from "@/shared/server/executive/pipelines/workforceExecutivePipeline.server";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fiscalMonthLabel(asOfDate: string) {
  const date = new Date(`${asOfDate}T00:00:00`);

  const fiscalMonthDate =
    date.getDate() >= 22
      ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
      : new Date(date.getFullYear(), date.getMonth(), 1);

  return fiscalMonthDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function uniqueScopedAffiliations(rows: WorkforceRow[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => String(row.affiliation ?? "").trim())
        .filter(Boolean)
    )
  );
}

async function loadRegionLabel(pcOrgId: string | null) {
  if (!pcOrgId) return "Region";

  const sb = await supabaseServer();

  const { data: org } = await sb
    .from("pc_org")
    .select("region_id, pc_org_name")
    .eq("pc_org_id", pcOrgId)
    .maybeSingle();

  if (!org?.region_id) return org?.pc_org_name ?? "Region";

  const { data: region } = await sb
    .from("region_admin_v")
    .select("region_name")
    .eq("region_id", org.region_id)
    .maybeSingle();

  return region?.region_name ?? org.pc_org_name ?? "Region";
}

export default async function DirectorWorkspacePageShell() {
  const asOfDate = todayIso();

  const scope = await requireSelectedPcOrgServer();

  const workforceDimension = scope.ok
    ? await buildWorkforceExecutiveDimension({
        pc_org_id: scope.selected_pc_org_id,
        as_of_date: asOfDate,
      })
    : {
        dimension: "workforce" as const,
        title: "Workforce",
        status: "empty" as const,
        artifacts: [],
      };

  let workforceRows: WorkforceRow[] = [];
  let workforceAffiliations: WorkforceAffiliationOption[] = [];
  let scopedAffiliations: string[] = [];
  let regionLabel = "Region";

  if (scope.ok) {
    const sourceRows = await loadWorkforceSourceRows({
      pc_org_id: scope.selected_pc_org_id,
      as_of_date: asOfDate,
    });

    const workforcePayload = await buildWorkforceSurfacePayload({
      pc_org_id: scope.selected_pc_org_id,
      rows: sourceRows,
    });

    workforceRows = workforcePayload.rows;
    workforceAffiliations = workforcePayload.editOptions?.affiliations ?? [];
    scopedAffiliations = uniqueScopedAffiliations(workforcePayload.rows);
    regionLabel = await loadRegionLabel(scope.selected_pc_org_id);
  }

  return (
    <PageShell>

      <DirectorWorkspaceSelector />

      <div className="space-y-4">
        <DirectorExecutiveWorkforceCard
          dimension={workforceDimension}
          workforceReports={{
            pcOrgId: scope.ok ? scope.selected_pc_org_id : undefined,
            rows: workforceRows,
            affiliations: workforceAffiliations,
            scopedAffiliations,
            regionLabel,
            reportMonthLabel: fiscalMonthLabel(asOfDate),
          }}
        />
      </div>
    </PageShell>
  );
}