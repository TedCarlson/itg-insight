// path: apps/web/src/shared/kpis/engine/inspectionBuilders/buildInspectionFtr.ts

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

export function buildInspectionFtr(args: {
  payload: any;
  activeRange: MetricsRangeKey;
}): InspectionRenderModel {
  const summary = args.payload?.summary ?? {};
  const trend = Array.isArray(args.payload?.trend) ? args.payload.trend : [];

  const currentRate =
    typeof summary.ftr_rate === "number" ? summary.ftr_rate : null;
  const totalJobs =
    typeof summary.total_contact_jobs === "number"
      ? summary.total_contact_jobs
      : null;
  const totalFails =
    typeof summary.total_fail_jobs === "number"
      ? summary.total_fail_jobs
      : null;

  const trendPoints = trend.map((row: any) => ({
    kpi_value:
      typeof row.ftr_rate === "number" && Number.isFinite(row.ftr_rate)
        ? row.ftr_rate
        : typeof row.kpi_value === "number" && Number.isFinite(row.kpi_value)
          ? row.kpi_value
          : null,
    is_month_final: !!row.is_month_final,
    band_color:
      typeof row.ftr_rate === "number" && row.ftr_rate >= 95
        ? "#22c55e"
        : typeof row.ftr_rate === "number" && row.ftr_rate >= 90
          ? "#eab308"
          : typeof row.ftr_rate === "number"
            ? "#ef4444"
            : null,
  }));

  const periodRows = trend.map((row: any) => ({
    key: `${row.metric_date ?? "na"}-${row.batch_id ?? "no-batch"}`,
    cells: [
      row.metric_date ?? "—",
      formatPct(row.ftr_rate ?? row.kpi_value),
      formatInt(row.total_contact_jobs),
      formatInt(row.total_fail_jobs),
    ],
  }));

  return {
    header: {
      title: "FTR %",
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
          key: "ftr_pct",
          label: "FTR %",
          align: "right",
          widthClass: "w-[90px]",
        },
        {
          key: "jobs",
          label: "Jobs",
          align: "right",
          widthClass: "w-[80px]",
        },
        {
          key: "fails",
          label: "Fails",
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
          formatInt(totalJobs),
          formatInt(totalFails),
        ],
      },
    },
  };
}