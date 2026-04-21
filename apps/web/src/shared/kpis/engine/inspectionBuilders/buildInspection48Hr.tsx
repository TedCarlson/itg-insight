// path: apps/web/src/shared/kpis/engine/inspectionBuilders/buildInspection48Hr.tsx

import type { InspectionRenderModel } from "@/shared/kpis/contracts/inspectionTypes";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";

function fmtNum(value: number | null | undefined, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(decimals);
}

function fmtInt(value: number | null | undefined) {
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

export function buildInspection48Hr(args: {
  payload: any;
  activeRange: MetricsRangeKey;
}): InspectionRenderModel {
  const summary = args.payload?.summary ?? {};
  const trend = Array.isArray(args.payload?.trend) ? args.payload.trend : [];

  const currentRate =
    typeof summary.callback_rate_48hr === "number"
      ? summary.callback_rate_48hr
      : null;

  const currentOrders =
    typeof summary.contact_orders_48hr === "number"
      ? summary.contact_orders_48hr
      : null;

  const currentEligible =
    typeof summary.eligible_jobs_48hr === "number"
      ? summary.eligible_jobs_48hr
      : null;

  const trendPoints = trend.map((row: any) => ({
    kpi_value:
      typeof row.callback_rate_48hr === "number" &&
      Number.isFinite(row.callback_rate_48hr)
        ? row.callback_rate_48hr
        : typeof row.kpi_value === "number" && Number.isFinite(row.kpi_value)
          ? row.kpi_value
          : null,
    is_month_final: !!row.is_month_final,
    band_color:
      typeof row.callback_rate_48hr === "number" && row.callback_rate_48hr >= 95
        ? "#22c55e"
        : typeof row.callback_rate_48hr === "number" && row.callback_rate_48hr >= 90
          ? "#eab308"
          : typeof row.callback_rate_48hr === "number"
            ? "#ef4444"
            : null,
  }));

  const periodRows = trend.map((row: any) => ({
    key: `${row.metric_date ?? "na"}-${row.batch_id ?? "no-batch"}`,
    cells: [
      row.metric_date ?? "—",
      fmtNum(row.callback_rate_48hr ?? row.kpi_value, 1),
      fmtInt(row.contact_orders_48hr),
      fmtInt(row.eligible_jobs_48hr),
    ],
  }));

  return {
    header: {
      title: "48Hr %",
      valueDisplay: fmtNum(currentRate, 1),
      rangeLabel: mapRangeLabel(args.activeRange),
    },
    trend: {
      title: "Trend",
      subtitle: "Checkpoint progression in selected window",
      badgeValue: fmtNum(currentRate, 1),
      currentValue: fmtNum(currentRate, 1),
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
          key: "rate",
          label: "48Hr %",
          align: "right",
          widthClass: "w-[90px]",
        },
        {
          key: "orders",
          label: "Orders",
          align: "right",
          widthClass: "w-[80px]",
        },
        {
          key: "eligible",
          label: "Eligible",
          align: "right",
          widthClass: "w-[80px]",
        },
      ],
      rows: periodRows,
      footer: {
        key: "footer",
        cells: [
          "TOTAL",
          fmtNum(currentRate, 1),
          fmtInt(currentOrders),
          fmtInt(currentEligible),
        ],
      },
    },
  };
}