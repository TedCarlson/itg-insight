// path: apps/web/src/features/role-company-manager/pages/CompanyManagerWorkforcePageShell.tsx

import { Card } from "@/components/ui/Card";
import { supabaseServer } from "@/shared/data/supabase/server";
import { ExhibitLauncher } from "@/shared/surfaces/reports/ExhibitLauncher";
import { OnboardingReportLauncher } from "@/shared/surfaces/reports/OnboardingReportLauncher";
import { WorkforceReportLauncher } from "@/shared/surfaces/reports/WorkforceReportLauncher";
import { WorkforceSurfaceClient } from "@/shared/surfaces/workforce/WorkforceSurfaceClient";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";
import type { WorkforceRow } from "@/shared/types/workforce/workforce.types";
import { getCompanyManagerWorkforceSurfacePayload } from "../lib/getCompanyManagerWorkforceSurfacePayload.server";

type WorkforceStatus = "ACTIVE" | "INACTIVE" | "ALL";

type Props = {
  selected_person_id?: string;
  search?: string;
  reports_to_person_id?: string;
  status?: WorkforceStatus;
  as_of_date?: string;
};

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

  return meta?.affiliation_type === "COMPANY" || label.includes("integrated tech group") || label === "itg";
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

export default async function CompanyManagerWorkforcePageShell(props: Props) {
  const asOfDate = props.as_of_date ?? todayIso();

  const payload = await getCompanyManagerWorkforceSurfacePayload({
    as_of_date: asOfDate,
  });

  const regionLabel = await loadRegionLabel(payload.rows[0]?.pc_org_id ?? null);
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
    <div className="space-y-4 p-4">
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Workforce
            </div>

            <div className="mt-1 text-2xl font-semibold tracking-tight">
              {regionLabel} Workforce Overview
            </div>

            <div className="mt-2 text-sm text-muted-foreground">
              HC: {totalHeadcount} Total • {fieldCount} field • {travelCount} Travel{" "}
              <span className="mx-1">|</span>
              Workforce Mix: {formatPercent(w2Percent)} W-2 • {formatPercent(bpPercent)} BP
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

            <button
              type="button"
              disabled
              className="rounded-xl border bg-muted/30 px-4 py-2 text-sm text-muted-foreground"
            >
              Org Chart
            </button>
          </div>
        </div>
      </Card>

      <WorkforceSurfaceClient payload={payload} mode="manager" />
    </div>
  );
}