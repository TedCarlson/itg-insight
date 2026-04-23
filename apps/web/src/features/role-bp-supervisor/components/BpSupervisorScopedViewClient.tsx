// path: apps/web/src/features/role-bp-supervisor/components/BpSupervisorScopedViewClient.tsx

"use client";

import { useMemo } from "react";

import MetricsSmartHeader from "@/shared/surfaces/MetricsSmartHeader";
import MetricsExecutiveKpiStrip from "@/shared/surfaces/MetricsExecutiveKpiStrip";
import MetricsRiskStrip from "@/shared/surfaces/MetricsRiskStrip";
import MetricsInspectableTeamPerformanceTable from "@/shared/surfaces/MetricsInspectableTeamPerformanceTable";

import { mapTeamRows } from "@/shared/lib/metrics/buildScopedRows";
import { buildScopedRiskInsights } from "@/shared/lib/metrics/scopedComputations";
import { buildScopedExecutiveStrip } from "@/shared/lib/metrics/buildScopedExecutiveStrip";

import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";

type Props = {
  payload: MetricsSurfacePayload;
};

type ReportClassType = "NSR" | "SMART";

function normalizeClassType(value: string | null | undefined): ReportClassType {
  return String(value ?? "NSR").trim().toUpperCase() === "SMART"
    ? "SMART"
    : "NSR";
}

export default function BpSupervisorScopedViewClient({ payload }: Props) {
  const scopedRows = useMemo(() => mapTeamRows(payload), [payload]);

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

  const classType = normalizeClassType(payload.header.role_label ? "NSR" : "NSR");

  return (
    <div className="space-y-4">
      <MetricsSmartHeader
        header={payload.header}
        scopeLabel="Your Team"
      />

      {payload.permissions.can_view_exec_strip ? (
        <MetricsExecutiveKpiStrip
          items={payload.executive_strip?.base?.items ?? []}
          comparisonItems={scopedExecutiveItems}
          comparisonTitle="Your Team Comparison"
          comparisonSubtitle="Current team slice compared against total org baseline."
          subtitle="Current stable set compared against the previous metric batch."
        />
      ) : null}

      {payload.permissions.can_view_risk_strip ? (
        <MetricsRiskStrip
          items={payload.risk_strip ?? []}
          insights={scopedRiskInsights}
        />
      ) : null}

      {payload.permissions.can_view_team_table ? (
        <MetricsInspectableTeamPerformanceTable
          columns={payload.team_table.columns.map((column) => ({
            kpi_key: column.kpi_key,
            label: column.label,
            report_order: column.report_order,
          }))}
          rows={scopedRows}
          range={payload.filters.active_range}
          classType={classType}
        />
      ) : null}
    </div>
  );
}