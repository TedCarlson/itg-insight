// path: apps/web/src/features/role-bp-supervisor/components/BpSupervisorScopedViewClient.tsx

"use client";

import { useMemo } from "react";

import MetricsSmartHeader from "@/shared/surfaces/MetricsSmartHeader";
import MetricsControlsStrip from "@/shared/surfaces/MetricsControlsStrip";
import MetricsExecutiveKpiStrip from "@/shared/surfaces/MetricsExecutiveKpiStrip";
import MetricsRiskStrip from "@/shared/surfaces/MetricsRiskStrip";
import MetricsInspectableTeamPerformanceTable from "@/shared/surfaces/MetricsInspectableTeamPerformanceTable";

import {
  buildScopedRows,
  mapTeamRows,
  type MetricsControlsValue,
} from "@/shared/lib/metrics/buildScopedRows";

import { buildScopedRiskInsights } from "@/shared/lib/metrics/scopedComputations";
import { buildScopedExecutiveStrip } from "@/shared/lib/metrics/buildScopedExecutiveStrip";

import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";

import { useBpSupervisorTeamControls } from "../hooks/useBpSupervisorTeamControls";
import { useBpSupervisorHeaderScope } from "../hooks/useBpSupervisorHeaderScope";

type Props = {
  payload: MetricsSurfacePayload;
};

type SupervisorOption = {
  value: string;
  label: string;
};

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean))
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
  const label =
    payload.header.org_display ??
    payload.header.pc_label ??
    "Region";

  const cleaned = String(label)
    .replace(/^HC\s+/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();

  return cleaned ? `${cleaned} Region` : "Region";
}

export default function BpSupervisorScopedViewClient({ payload }: Props) {
  const allRows = useMemo(() => mapTeamRows(payload), [payload]);

  const supervisorOptions = useMemo(
    () => buildSupervisorOptions(allRows),
    [allRows]
  );

  const contractorOptions = useMemo(
    () => uniqueSorted(allRows.map((r) => r.contractor_name)),
    [allRows]
  );

  const repPersonId = String(
    (payload.header as any).rep_person_id ?? ""
  ).trim();

  // 🔥 THIS IS THE ENTIRE FIX
  const controls: MetricsControlsValue = useMemo(() => {
    const hasSupervisor = supervisorOptions.some(
      (s) => s.value === repPersonId
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

    // fallback → affiliate
    return {
      office_label: null,
      affiliation_type: "CONTRACTOR",
      contractor_name:
        contractorOptions.length === 1 ? contractorOptions[0] : null,
      reports_to_person_id: null,
      team_scope_mode: "ROLLUP",
    };
  }, [repPersonId, supervisorOptions, contractorOptions]);

  const { showTeamScope } = useBpSupervisorTeamControls(allRows, controls);

  const scopedRows = useMemo(() => {
    const rows = buildScopedRows(allRows, controls);
    return rows.length > 0 ? rows : allRows;
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

  return (
    <div className="space-y-4">
      <MetricsSmartHeader
        header={{
          ...headerModel,
          rep_full_name: (() => {
            const affiliate = scopedRows
              .map((r) => String(r.contractor_name ?? "").trim())
              .find(Boolean);

            return affiliate && headerModel.rep_full_name
              ? `${affiliate} • ${headerModel.rep_full_name}`
              : headerModel.rep_full_name;
          })(),
        }}
        scopeLabel={scopeLabel}
      />

      {/* 🔒 locked controls (same as company supervisor pattern) */}
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
      />

      <MetricsRiskStrip
        items={payload.risk_strip ?? []}
        insights={scopedRiskInsights}
      />

      <MetricsInspectableTeamPerformanceTable
        columns={payload.team_table.columns.map((c) => ({
          kpi_key: c.kpi_key,
          label: c.label,
          report_order: c.report_order,
        }))}
        rows={scopedRows}
        range={payload.filters.active_range}
        classType={"NSR"}
      />
    </div>
  );
}