// path: apps/web/src/shared/kpis/engine/inspectionBuilders/buildInspectionToolUsage.ts

import type { InspectionRenderModel } from "@/shared/kpis/contracts/inspectionTypes";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function formatInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

function mapRangeLabel(activeRange: MetricsRangeKey): string {
  if (activeRange === "FM") return "Current FM";
  if (activeRange === "PREVIOUS") return "Previous FM";
  if (activeRange === "3FM") return "Last 3 FM";
  if (activeRange === "12FM") return "Last 12 FM";
  return String(activeRange);
}

export function buildInspectionToolUsage(args: {
  payload: any;
  activeRange: MetricsRangeKey;
}): InspectionRenderModel {
  const summary = args.payload?.summary ?? {};
  const trend = Array.isArray(args.payload?.trend) ? args.payload.trend : [];

  const currentRate =
    typeof summary.tool_usage_rate === "number"
      ? summary.tool_usage_rate
      : null;
  const totalEligible =
    typeof summary.tu_eligible_jobs === "number"
      ? summary.tu_eligible_jobs
      : null;
  const totalCompliant =
    typeof summary.tu_compliant_jobs === "number"
      ? summary.tu_compliant_jobs
      : null;

  const trendPoints = trend.map((row: any) => ({
    kpi_value:
      typeof row.tool_usage_rate === "number" &&
      Number.isFinite(row.tool_usage_rate)
        ? row.tool_usage_rate
        : typeof row.kpi_value === "number" && Number.isFinite(row.kpi_value)
          ? row.kpi_value
          : null,
    is_month_final: !!row.is_month_final,
    band_color:
      typeof row.tool_usage_rate === "number" && row.tool_usage_rate >= 95
        ? "#22c55e"
        : typeof row.tool_usage_rate === "number" && row.tool_usage_rate >= 90
          ? "#eab308"
          : typeof row.tool_usage_rate === "number"
            ? "#ef4444"
            : null,
  }));

  const periodRows = trend.map((row: any) => ({
    key: `${row.metric_date ?? "na"}-${row.batch_id ?? "no-batch"}`,
    cells: [
      row.metric_date ?? "—",
      formatPct(row.tool_usage_rate ?? row.kpi_value),
      formatInt(row.tu_eligible_jobs),
      formatInt(row.tu_compliant_jobs),
    ],
  }));

  return {
    header: {
      title: "Tool Usage %",
      valueDisplay: formatPct(currentRate),
      rangeLabel: mapRangeLabel(args.activeRange),
    },
    trend: {
      title: "Trend",
      subtitle: "Checkpoint progression in selected window",
      badgeValue: formatPct(currentRate),
      currentValue: formatPct(currentRate),
      updatesCount: trend.length,
      monthsCount:
        args.payload?.debug?.selected_month_count ??
        args.payload?.debug?.distinct_fiscal_month_count ??
        null,
      rangeLabel: mapRangeLabel(args.activeRange),
      points: trendPoints,
    },
    periodDetail: {
      title: "Period Detail",
      columns: [
        { key: "metric_date", label: "Metric Date" },
        {
          key: "tool_usage_pct",
          label: "Tool Usage %",
          align: "right",
          widthClass: "w-[110px]",
        },
        {
          key: "eligible",
          label: "Eligible",
          align: "right",
          widthClass: "w-[80px]",
        },
        {
          key: "compliant",
          label: "Compliant",
          align: "right",
          widthClass: "w-[90px]",
        },
      ],
      rows: periodRows,
      footer: {
        key: "footer",
        cells: [
          "TOTAL",
          formatPct(currentRate),
          formatInt(totalEligible),
          formatInt(totalCompliant),
        ],
      },
    },
  };
}