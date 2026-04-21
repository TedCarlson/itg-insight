// path: apps/web/src/shared/kpis/engine/inspectionBuilders/buildInspectionMet.ts

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

export function buildInspectionMet(args: {
  payload: any;
  activeRange: MetricsRangeKey;
}): InspectionRenderModel {
  const summary = args.payload?.summary ?? {};
  const trend = Array.isArray(args.payload?.trend) ? args.payload.trend : [];

  const currentRate =
    typeof summary.met_rate === "number" ? summary.met_rate : null;
  const totalMet =
    typeof summary.met_count === "number" ? summary.met_count : null;
  const totalAppts =
    typeof summary.total_appts === "number" ? summary.total_appts : null;

  const trendPoints = trend.map((row: any) => ({
    kpi_value:
      typeof row.met_rate === "number" && Number.isFinite(row.met_rate)
        ? row.met_rate
        : typeof row.kpi_value === "number" && Number.isFinite(row.kpi_value)
          ? row.kpi_value
          : null,
    is_month_final: !!row.is_month_final,
    band_color:
      typeof row.met_rate === "number" && row.met_rate >= 95
        ? "#22c55e"
        : typeof row.met_rate === "number" && row.met_rate >= 90
          ? "#eab308"
          : typeof row.met_rate === "number"
            ? "#ef4444"
            : null,
  }));

  const periodRows = trend.map((row: any) => ({
    key: `${row.metric_date ?? "na"}-${row.batch_id ?? "no-batch"}`,
    cells: [
      row.metric_date ?? "—",
      formatPct(row.met_rate ?? row.kpi_value),
      formatInt(row.met_count),
      formatInt(row.total_appts),
    ],
  }));

  return {
    header: {
      title: "MET %",
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
          key: "met_pct",
          label: "MET %",
          align: "right",
          widthClass: "w-[90px]",
        },
        {
          key: "met",
          label: "Met",
          align: "right",
          widthClass: "w-[80px]",
        },
        {
          key: "appts",
          label: "Appts",
          align: "right",
          widthClass: "w-[80px]",
        },
      ],
      rows: periodRows,
      footer: {
        key: "footer",
        cells: [
          "TOTAL",
          formatPct(currentRate),
          formatInt(totalMet),
          formatInt(totalAppts),
        ],
      },
    },
  };
}