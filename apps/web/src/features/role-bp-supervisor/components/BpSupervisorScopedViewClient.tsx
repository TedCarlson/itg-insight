// path: apps/web/src/features/role-bp-supervisor/components/BpSupervisorScopedViewClient.tsx

"use client";

import { useMemo } from "react";

import MetricsControlsStrip from "@/shared/surfaces/MetricsControlsStrip";
import MetricsExecutiveKpiMatrix from "@/shared/surfaces/MetricsExecutiveKpiMatrix";
import MetricsExecutiveKpiStrip from "@/shared/surfaces/MetricsExecutiveKpiStrip";
import MetricsInspectableTeamPerformanceTable from "@/shared/surfaces/MetricsInspectableTeamPerformanceTable";
import MetricsRiskStrip from "@/shared/surfaces/MetricsRiskStrip";
import MetricsSmartHeader from "@/shared/surfaces/MetricsSmartHeader";

import {
  buildScopedRows,
  mapTeamRows,
  type MetricsControlsValue,
} from "@/shared/lib/metrics/buildScopedRows";

import { buildScopedExecutiveStrip } from "@/shared/lib/metrics/buildScopedExecutiveStrip";
import { buildScopedRiskInsights } from "@/shared/lib/metrics/scopedComputations";

import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";

import { useBpSupervisorHeaderScope } from "../hooks/useBpSupervisorHeaderScope";
import { useBpSupervisorTeamControls } from "../hooks/useBpSupervisorTeamControls";

type Props = {
  payload: MetricsSurfacePayload;
};

type BpOwnerOrgKpiRow = {
  pc_org_id?: string | null;
  org_label: string;
  items: NonNullable<MetricsSurfacePayload["executive_strip"]>["base"]["items"];
};

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

function buildSupervisorOptions(rows: ReturnType<typeof mapTeamRows>) {
  const map = new Map<string, string>();

  for (const row of rows) {
    const id = String(row.reports_to_person_id ?? "").trim();
    if (!id) continue;

    const label = String(row.reports_to_label ?? "").trim() || id;

    if (!map.has(id)) map.set(id, label);
  }

  return [...map.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
}

function regionKpiTitle(payload: MetricsSurfacePayload): string {
  const label = payload.header.org_display ?? payload.header.pc_label ?? "Region";

  const cleaned = String(label)
    .replace(/^HC\s+/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();

  return cleaned ? `${cleaned} Region` : "Region";
}

function contractorLabel(payload: MetricsSurfacePayload) {
  return (
    String(payload.header.org_display ?? "")
      .replace(/^HC\s+/i, "")
      .replace(/\s*\([^)]*\)\s*$/g, "")
      .trim() || "Contractor"
  );
}

function getBpOwnerOrgKpiRows(payload: MetricsSurfacePayload): BpOwnerOrgKpiRow[] {
  const raw = (payload as unknown as { bp_owner_org_kpi_rows?: unknown })
    .bp_owner_org_kpi_rows;

  if (!Array.isArray(raw)) return [];

  return raw
    .map((row) => {
      const item = row as Partial<BpOwnerOrgKpiRow>;

      return {
        pc_org_id: item.pc_org_id ?? null,
        org_label: String(item.org_label ?? "").trim(),
        items: Array.isArray(item.items) ? item.items : [],
      };
    })
    .filter((row) => row.org_label);
}

export default function BpSupervisorScopedViewClient({ payload }: Props) {
  const allRows = useMemo(() => mapTeamRows(payload), [payload]);

  const supervisorOptions = useMemo(
    () => buildSupervisorOptions(allRows),
    [allRows]
  );

  const contractorOptions = useMemo(
    () => uniqueSorted(allRows.map((row) => row.contractor_name)),
    [allRows]
  );

  const repPersonId = String((payload.header as any).rep_person_id ?? "").trim();

  const controls: MetricsControlsValue = useMemo(() => {
    const hasSupervisor = supervisorOptions.some(
      (supervisor) => supervisor.value === repPersonId
    );

    if (hasSupervisor) {
      return {
        office_label: null,
        affiliation_type: null,
        contractor_name: null,
        reports_to_person_id: repPersonId,
        team_scope_mode: "ROLLUP",
      };
    }

    return {
      office_label: null,
      affiliation_type: "CONTRACTOR",
      contractor_name:
        contractorOptions.length === 1 ? contractorOptions[0] : null,
      reports_to_person_id: null,
      team_scope_mode: "ROLLUP",
    };
  }, [repPersonId, supervisorOptions, contractorOptions]);

  useBpSupervisorTeamControls(allRows, controls);

  const scopedRows = useMemo(() => {
    return buildScopedRows(allRows, controls);
  }, [allRows, controls]);

  const { scopeLabel, headerModel } = useBpSupervisorHeaderScope({
    controls,
    allRows,
    scopedRows,
    header: payload.header,
  });

  const scopedExecutiveItems = useMemo(() => {
    return buildScopedExecutiveStrip({
      runtime: payload.executive_strip?.runtime ?? null,
      scopedRows,
      fallbackItems: payload.executive_strip?.scope?.items ?? [],
    });
  }, [payload.executive_strip, scopedRows]);

  const scopedRiskInsights = useMemo(() => {
    return buildScopedRiskInsights({
      source: payload.risk_insights,
      scopedRows,
    });
  }, [payload.risk_insights, scopedRows]);

  const bpOwnerOrgKpiRows = useMemo(
    () => getBpOwnerOrgKpiRows(payload),
    [payload]
  );

  const hasBpOwnerOrgRows = bpOwnerOrgKpiRows.length > 0;
  const contractor = contractorLabel(payload);

  return (
    <div className="space-y-4">
      <MetricsSmartHeader
        header={{
          ...headerModel,
          rep_full_name: (() => {
            const affiliate = scopedRows
              .map((row) => String(row.contractor_name ?? "").trim())
              .find(Boolean);

            return affiliate && headerModel.rep_full_name
              ? `${affiliate} • ${headerModel.rep_full_name}`
              : headerModel.rep_full_name;
          })(),
        }}
        scopeLabel={scopeLabel}
      />

      <div className="opacity-60">
        <MetricsControlsStrip
          officeOptions={[]}
          affiliationOptions={[]}
          contractorOptions={contractorOptions}
          supervisorOptions={supervisorOptions}
          showOffice={false}
          showAffiliation={false}
          showContractor={false}
          showSupervisor={false}
          showTeamScope={false}
          value={controls}
          onChange={() => undefined}
          onReset={() => undefined}
        />
      </div>

      {hasBpOwnerOrgRows ? (
        <MetricsExecutiveKpiMatrix
          title={`${contractor} Metrics`}
          subtitle="Contractor performance first, with regional benchmark context inside each KPI."
          rows={[
            {
              label: `${contractor} Total`,
              subtitle: "Recomputed contractor aggregate across covered orgs.",
              items: payload.executive_strip?.base?.items ?? [],
            },
            ...bpOwnerOrgKpiRows.map((row) => ({
              label: `${contractor} • ${row.org_label}`,
              subtitle: "Contractor performance inside this region.",
              items: row.items,
            })),
          ]}
          runtime={payload.executive_strip?.runtime ?? null}
        />
      ) : (
        <MetricsExecutiveKpiStrip
          title={regionKpiTitle(payload)}
          items={payload.executive_strip?.base?.items ?? []}
          comparisonItems={scopedExecutiveItems}
          comparisonTitle={
            controls.reports_to_person_id
              ? "Your Team Comparison"
              : "Affiliate Comparison"
          }
          comparisonSubtitle="Scoped comparison against total org baseline."
          runtime={payload.executive_strip?.runtime ?? null}
        />
      )}

      <MetricsRiskStrip
        items={payload.risk_strip ?? []}
        insights={scopedRiskInsights}
      />

      <MetricsInspectableTeamPerformanceTable
        columns={payload.team_table.columns.map((column) => ({
          kpi_key: column.kpi_key,
          label: column.label,
          report_order: column.report_order,
        }))}
        rows={scopedRows}
        range={payload.filters.active_range}
        classType="NSR"
      />
    </div>
  );
}