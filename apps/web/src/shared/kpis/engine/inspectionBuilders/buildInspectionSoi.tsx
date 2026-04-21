// path: apps/web/src/shared/kpis/engine/inspectionBuilders/buildInspectionSoi.ts

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

export function buildInspectionSoi(args: {
  payload: any;
  activeRange: MetricsRangeKey;
}): InspectionRenderModel {
  const summary = args.payload?.summary ?? {};
  const trend = Array.isArray(args.payload?.trend) ? args.payload.trend : [];

  const currentRate =
    typeof summary.soi_rate === "number" ? summary.soi_rate : null;
  const totalSoi =
    typeof summary.soi_count === "number" ? summary.soi_count : null;
  const totalInstalls =
    typeof summary.installs === "number" ? summary.installs : null;

  const trendPoints = trend.map((row: any) => ({
    kpi_value:
      typeof row.soi_rate === "number" && Number.isFinite(row.soi_rate)
        ? row.soi_rate
        : typeof row.kpi_value === "number" && Number.isFinite(row.kpi_value)
          ? row.kpi_value
          : null,
    is_month_final: !!row.is_month_final,
    band_color:
      typeof row.soi_rate === "number" && row.soi_rate <= 5
        ? "#22c55e"
        : typeof row.soi_rate === "number" && row.soi_rate <= 8
          ? "#eab308"
          : typeof row.soi_rate === "number"
            ? "#ef4444"
            : null,
  }));

  const periodRows = trend.map((row: any) => ({
    key: `${row.metric_date ?? "na"}-${row.batch_id ?? "no-batch"}`,
    cells: [
      row.metric_date ?? "—",
      formatPct(row.soi_rate ?? row.kpi_value),
      formatInt(row.soi_count),
      formatInt(row.installs),
    ],
  }));

  return {
    header: {
      title: "SOI %",
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
          key: "soi_pct",
          label: "SOI %",
          align: "right",
          widthClass: "w-[90px]",
        },
        {
          key: "soi",
          label: "SOI",
          align: "right",
          widthClass: "w-[80px]",
        },
        {
          key: "installs",
          label: "Installs",
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
          formatInt(totalSoi),
          formatInt(totalInstalls),
        ],
      },
    },
  };
}