// path: apps/web/src/features/role-director/pages/DirectorWorkforcePageShell.tsx

import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/ui/PageShell";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { buildWorkforceSurfacePayload } from "@/shared/server/workforce/buildWorkforceSurfacePayload.server";
import { loadWorkforceSourceRows } from "@/shared/server/workforce/loadWorkforceSourceRows.server";
import { DirectorWorkspaceSelector } from "@/shared/surfaces/navigation/DirectorWorkspaceSelector";
import { ExhibitLauncher } from "@/shared/surfaces/reports/ExhibitLauncher";
import { OnboardingReportLauncher } from "@/shared/surfaces/reports/OnboardingReportLauncher";
import { RosterExportLauncher } from "@/shared/surfaces/reports/RosterExportLauncher";
import { WorkforceReportLauncher } from "@/shared/surfaces/reports/WorkforceReportLauncher";
import { WorkforceSurfaceClient } from "@/shared/surfaces/workforce/WorkforceSurfaceClient";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";
import type { WorkforceRow } from "@/shared/types/workforce/workforce.types";

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

function isWorkforceHeadcount(row: WorkforceRow) {
  return row.is_active && (row.seat_type === "FIELD" || row.seat_type === "TRAVEL");
}

function affiliationMeta(
  row: WorkforceRow,
  affiliations: WorkforceAffiliationOption[]
) {
  return affiliations.find(
    (option) =>
      option.affiliation_id === row.affiliation_id ||
      option.affiliation_label === row.affiliation ||
      option.affiliation_code === row.affiliation
  );
}

function isW2(row: WorkforceRow, affiliations: WorkforceAffiliationOption[]) {
  const meta = affiliationMeta(row, affiliations);
  const label = String(row.affiliation ?? "").toLowerCase();

  return (
    meta?.affiliation_type === "COMPANY" ||
    label.includes("integrated tech group") ||
    label === "itg"
  );
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
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

export default async function DirectorWorkforcePageShell() {
  const asOfDate = todayIso();
  const scope = await requireSelectedPcOrgServer();

  if (!scope.ok) {
    return (
      <PageShell>
        <DirectorWorkspaceSelector />

        <Card className="p-4">
          <div className="text-sm font-medium">No selected organization</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Select an organization to load the Director Workforce workspace.
          </div>
        </Card>
      </PageShell>
    );
  }

  const sourceRows = await loadWorkforceSourceRows({
    pc_org_id: scope.selected_pc_org_id,
    as_of_date: asOfDate,
  });

  const payload = await buildWorkforceSurfacePayload({
    pc_org_id: scope.selected_pc_org_id,
    rows: sourceRows,
  });

  const regionLabel = await loadRegionLabel(scope.selected_pc_org_id);
  const reportMonthLabel = fiscalMonthLabel(asOfDate);
  const affiliations = payload.editOptions?.affiliations ?? [];

  const headcountRows = payload.rows.filter(isWorkforceHeadcount);
  const fieldCount = headcountRows.filter((row) => row.seat_type === "FIELD").length;
  const travelCount = headcountRows.filter((row) => row.seat_type === "TRAVEL").length;
  const totalHeadcount = fieldCount + travelCount;

  const w2Count = headcountRows.filter((row) => isW2(row, affiliations)).length;
  const bpCount = totalHeadcount - w2Count;

  const w2Percent = totalHeadcount ? (w2Count / totalHeadcount) * 100 : 0;
  const bpPercent = totalHeadcount ? (bpCount / totalHeadcount) * 100 : 0;
  const scopedAffiliations = uniqueScopedAffiliations(headcountRows);

  return (
    <PageShell>
      <DirectorWorkspaceSelector />

      <div className="space-y-4">
        <Card className="p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Workforce
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                {regionLabel} • HC {totalHeadcount} • {fieldCount} Field •{" "}
                {travelCount} Travel • {formatPercent(w2Percent)} W-2 •{" "}
                {formatPercent(bpPercent)} BP
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <ExhibitLauncher
                rows={payload.rows}
                affiliations={affiliations}
                regionLabel={regionLabel}
                reportMonthLabel={reportMonthLabel}
              />

              <WorkforceReportLauncher
                rows={payload.rows}
                regionLabel={regionLabel}
                reportMonthLabel={reportMonthLabel}
              />

              <OnboardingReportLauncher
                regionLabel={regionLabel}
                reportMonthLabel={reportMonthLabel}
                scopedAffiliations={scopedAffiliations}
              />

              <RosterExportLauncher
                rows={payload.rows}
                regionLabel={regionLabel}
                reportMonthLabel={reportMonthLabel}
              />
            </div>
          </div>
        </Card>

        <WorkforceSurfaceClient payload={payload} mode="manager" />
      </div>
    </PageShell>
  );
}
