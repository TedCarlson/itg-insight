import Sparkline from "@/shared/components/Sparkline";
import MetricPeriodDetailTable from "@/features/tech/metrics/components/MetricPeriodDetailTable";
import { aggregateRatio } from "@/shared/kpis/core/aggregateRatio";
import type { ScorecardTile } from "@/shared/kpis/core/scorecardTypes";
import type { MetricsRangeKey as RangeKey } from "@/shared/kpis/core/types";

type Tile = ScorecardTile;

export type Callback48HrDebug = {
  requested_range?: string;
  distinct_fiscal_month_count?: number;
  distinct_fiscal_months_found?: string[];
  selected_month_count?: number;
  selected_final_rows: Array<{
    fiscal_end_date?: string;
    metric_date: string;
    batch_id?: string;
    inserted_at?: string;
    rows_in_month?: number;
    contact_orders_48hr: number | null;
    eligible_jobs_48hr: number | null;
    callback_rate_48hr: number | null;
  }>;
  trend?: Array<{
    fiscal_end_date: string;
    metric_date: string;
    batch_id: string;
    inserted_at?: string;
    contact_orders_48hr: number | null;
    eligible_jobs_48hr: number | null;
    callback_rate_48hr: number | null;
    kpi_value: number | null;
    is_month_final: boolean;
  }>;
} | null;

function formatPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function computeRangeValue(
  rows: Array<{
    eligible_jobs_48hr: number | null;
    contact_orders_48hr: number | null;
    callback_rate_48hr: number | null;
  }>
): string {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) => row.contact_orders_48hr ?? 0,
    getDenominator: (row) => row.eligible_jobs_48hr ?? 0,
  });

  if (agg.denominator > 0) {
    return formatPct(agg.value);
  }

  if (rows.length === 1) {
    return formatPct(rows[0]?.callback_rate_48hr ?? null);
  }

  return "—";
}

export function build48HrDrawerModel(args: {
  tile: Tile;
  callback48HrDebug: Callback48HrDebug;
  activeRange: RangeKey;
}) {
  const selectedRows = args.callback48HrDebug?.selected_final_rows ?? [];

  const currentRows = selectedRows.slice(0, 1);
  const previousRows = selectedRows.slice(0, 1);
  const last3Rows = selectedRows.slice(0, 3);
  const last12Rows = selectedRows.slice(0, 12);

  const summaryRows: Array<{ label: string; value: string }> = [];

  if (args.activeRange === "FM") {
    summaryRows.push({
      label: "Current FM",
      value: computeRangeValue(currentRows),
    });
  } else if (args.activeRange === "PREVIOUS") {
    summaryRows.push({
      label: "Previous FM",
      value: computeRangeValue(previousRows),
    });
  } else if (args.activeRange === "3FM") {
    summaryRows.push({
      label: "Last 3 FM",
      value: computeRangeValue(last3Rows),
    });
  } else if (args.activeRange === "12FM") {
    summaryRows.push({
      label: "Last 12 FM",
      value: computeRangeValue(last12Rows),
    });
  }

  const totalAgg = aggregateRatio({
    rows: selectedRows,
    getNumerator: (row) => row.contact_orders_48hr ?? 0,
    getDenominator: (row) => row.eligible_jobs_48hr ?? 0,
  });

  const totalEligible = totalAgg.denominator;
  const totalOrders = totalAgg.numerator;
  const totalRate = computeRangeValue(selectedRows);

  const periodRows = selectedRows.map((row) => {
    const rowAgg = aggregateRatio({
      rows: [row],
      getNumerator: (r) => r.contact_orders_48hr ?? 0,
      getDenominator: (r) => r.eligible_jobs_48hr ?? 0,
    });

    const rowPct =
      rowAgg.denominator > 0
        ? formatPct(rowAgg.value)
        : formatPct(row.callback_rate_48hr);

    return {
      key: `${row.metric_date}-${row.batch_id ?? "no-batch"}`,
      cells: [
        row.metric_date,
        rowPct,
        row.contact_orders_48hr ?? "—",
        row.eligible_jobs_48hr ?? "—",
      ],
    };
  });

  const periodFooter = {
    key: "footer",
    cells: ["TOTAL", totalRate, totalOrders || "—", totalEligible || "—"],
  };

  return {
    summaryRows,
    chart: (
      <Sparkline
        values={(args.callback48HrDebug?.trend ?? []).map((t) => ({
          kpi_value: t.kpi_value,
          is_month_final: t.is_month_final,
          band_color:
            t.kpi_value != null && t.kpi_value <= 5
              ? "#22c55e"
              : t.kpi_value != null && t.kpi_value <= 8
                ? "#eab308"
                : "#ef4444",
        }))}
      />
    ),
    periodDetail: (
      <MetricPeriodDetailTable
        title="Period Detail"
        columns={[
          {
            key: "metric_date",
            label: "Metric Date",
          },
          {
            key: "callback_pct",
            label: "48Hr %",
            align: "right",
            widthClass: "90px",
          },
          {
            key: "orders",
            label: "Orders",
            align: "right",
            widthClass: "90px",
          },
          {
            key: "eligible",
            label: "Eligible",
            align: "right",
            widthClass: "90px",
          },
        ]}
        rows={periodRows}
        footer={periodFooter}
      />
    ),
  };
}