// path: apps/web/src/shared/surfaces/MetricsInspectableTeamPerformanceTable.tsx

"use client";

import { useMemo } from "react";

import MetricsTeamPerformanceTable, {
  type MetricsHelpSection,
  type MetricsInspectionMetricCell,
  type MetricsTeamColumn,
  type MetricsTeamRow,
} from "@/shared/surfaces/MetricsTeamPerformanceTable";

import MetricsTechDrillDrawer from "@/shared/surfaces/MetricsTechDrillDrawer";

import type { KpiBandKey, MetricsRangeKey } from "@/shared/kpis/core/types";
import type { InspectionMetricCell } from "@/shared/kpis/contracts/inspectionTypes";

type ReportClassType = "NSR" | "SMART";

type Props = {
  title?: string;
  columns: MetricsTeamColumn[];
  rows: MetricsTeamRow[];
  range?: MetricsRangeKey;
  classType: ReportClassType;

  workMixTitle?: string;
  workMixContent?: React.ReactNode;

  parityTitle?: string;
  parityContent?: React.ReactNode;

  helpTitle?: string;
  helpSubtitle?: string;
  helpSections?: MetricsHelpSection[];

  onOpenJobs?: (row: MetricsTeamRow) => void;
};

function buildInspectionContext(row: any) {
  return [
    row.tech_id,
    row.office_label,
    row.contractor_name,
    row.affiliation_type,
  ]
    .filter(Boolean)
    .join(" • ");
}

function normalizeBandKey(value: string | null | undefined): KpiBandKey {
  if (value === "EXCEEDS") return "EXCEEDS";
  if (value === "MEETS") return "MEETS";
  if (value === "NEEDS_IMPROVEMENT") return "NEEDS_IMPROVEMENT";
  if (value === "MISSES") return "MISSES";
  return "NO_DATA";
}

function orderInspectionMetrics(
  metrics: MetricsInspectionMetricCell[],
  orderedKpiKeys: string[]
): InspectionMetricCell[] {
  const orderMap = new Map(orderedKpiKeys.map((k, i) => [k, i]));

  return [...metrics]
    .sort((a, b) => {
      const ao = orderMap.get(a.kpi_key) ?? 999;
      const bo = orderMap.get(b.kpi_key) ?? 999;
      if (ao !== bo) return ao - bo;
      return a.label.localeCompare(b.label);
    })
    .map((m) => ({
      kpi_key: m.kpi_key,
      label: m.label,
      value: m.value,
      value_display: m.value_display,
      band_key: normalizeBandKey(m.band_key),
      inspection_payload: (m as any).inspection_payload ?? null,
    })) as InspectionMetricCell[];
}

function resolvePersonId(row: MetricsTeamRow): string | null {
  return (
    (row as any).person_id ??
    (row as any).subject_person_id ??
    row.subject_key ??
    null
  );
}

function buildInspectionUrl(args: {
  row: MetricsTeamRow;
  metric: InspectionMetricCell;
  range?: MetricsRangeKey;
  classType: ReportClassType;
  context: string;
}) {
  const { row, metric, range, classType, context } = args;

  const personId = resolvePersonId(row);
  const techId = row.tech_id ?? null;

  if (!personId || !techId || !metric.kpi_key) return null;

  const params = new URLSearchParams();

  params.set("person_id", personId);
  params.set("tech_id", techId);
  params.set("full_name", String(row.full_name ?? techId));
  params.set("context", context || "Tech");
  params.set("kpi_key", metric.kpi_key);
  params.set("title", metric.label);
  params.set("band_key", metric.band_key);
  params.set("range", range ?? "FM");
  params.set("class_type", classType);

  if (metric.value_display != null) {
    params.set("value_display", metric.value_display);
  }

  if (typeof metric.value === "number" && Number.isFinite(metric.value)) {
    params.set("value", String(metric.value));
  }

  const contractorName =
    (row as any).contractor_name ??
    (row as any).affiliation ??
    (row as any).affiliation_type ??
    (row as any).co_code ??
    null;

  if (contractorName) {
    params.set("contractor_name", String(contractorName));
  }

  return `/api/metrics/inspection?${params.toString()}`;
}

export default function MetricsInspectableTeamPerformanceTable({
  title,
  columns,
  rows,
  range,
  classType,
  workMixTitle,
  workMixContent,
  parityTitle,
  parityContent,
  helpTitle,
  helpSubtitle,
  helpSections,
  onOpenJobs,
}: Props) {
  const orderedKpiKeys = useMemo(
    () => columns.map((c) => c.kpi_key),
    [columns]
  );

  return (
    <MetricsTeamPerformanceTable
      title={title}
      columns={columns}
      rows={rows}
      range={range}
      workMixTitle={workMixTitle}
      workMixContent={workMixContent}
      parityTitle={parityTitle}
      parityContent={parityContent}
      helpTitle={helpTitle}
      helpSubtitle={helpSubtitle}
      helpSections={helpSections}
      onOpenJobs={onOpenJobs}
      renderInspectionDrawer={({ open, onClose, row, column, metrics }) => {
        const orderedMetrics = orderInspectionMetrics(metrics, orderedKpiKeys);
        const context = buildInspectionContext(row);

        return (
          <MetricsTechDrillDrawer
            open={open}
            onClose={onClose}
            name={String(row.full_name ?? row.tech_id)}
            context={context}
            metrics={orderedMetrics}
            selectedKpi={column.kpi_key}
            loadPayload={async (kpiKey) => {
              const metric = orderedMetrics.find((m) => m.kpi_key === kpiKey);
              if (!metric) return null;

              const url = buildInspectionUrl({
                row,
                metric,
                range,
                classType,
                context,
              });

              if (!url) return null;

              const response = await fetch(url, {
                method: "GET",
                headers: { Accept: "application/json" },
              });

              if (!response.ok) return null;

              const data = await response.json();
              return data?.ok ? data.payload ?? null : null;
            }}
          />
        );
      }}
    />
  );
}