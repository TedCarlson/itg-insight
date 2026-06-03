// path: apps/web/src/features/role-director/pages/DirectorExecutiveSuitePageShell.tsx

import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { DirectorWorkspaceSelector } from "@/shared/surfaces/navigation/DirectorWorkspaceSelector";
import { buildWorkforceSurfacePayload } from "@/shared/server/workforce/buildWorkforceSurfacePayload.server";
import { loadWorkforceSourceRows } from "@/shared/server/workforce/loadWorkforceSourceRows.server";
import type { MetricsRangeKey } from "@/shared/types/metrics/surfacePayload";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";
import type { WorkforceRow } from "@/shared/types/workforce/workforce.types";
import DirectorExecutiveSuiteClient from "../components/DirectorExecutiveSuiteClient";
import { getDirectorExecutivePayload } from "../lib/getDirectorExecutivePayload.server";

type DirectorDimensionKey = "overview" | "workforce" | "metrics" | "route-lock";

function normalizeRange(value: string | undefined): MetricsRangeKey {
  const upper = String(value ?? "FM").trim().toUpperCase();

  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";

  return "FM";
}

function normalizeDimension(value: string | undefined): DirectorDimensionKey {
  const normalized = String(value ?? "overview").trim().toLowerCase();

  if (normalized === "workforce") return "workforce";
  if (normalized === "metrics") return "metrics";
  if (normalized === "route-lock" || normalized === "routelock") {
    return "route-lock";
  }

  return "overview";
}

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

export default async function DirectorExecutiveSuitePageShell(props: {
  range?: string;
  dimension?: string;
}) {
  const asOfDate = todayIso();

  const [payload, scope] = await Promise.all([
    getDirectorExecutivePayload({
      range: normalizeRange(props.range),
    }),
    requireSelectedPcOrgServer(),
  ]);

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

      <DirectorExecutiveSuiteClient
        payload={payload}
        activeDimension={normalizeDimension(props.dimension)}
        workforceReports={{
          rows: workforceRows,
          affiliations: workforceAffiliations,
          scopedAffiliations,
          regionLabel,
          reportMonthLabel: fiscalMonthLabel(asOfDate),
        }}
      />
    </PageShell>
  );
}