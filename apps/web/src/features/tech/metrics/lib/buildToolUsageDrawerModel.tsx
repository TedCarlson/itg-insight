import Sparkline from "@/shared/components/Sparkline";
import MetricPeriodDetailTable from "@/features/tech/metrics/components/MetricPeriodDetailTable";
import { aggregateRatio } from "@/shared/kpis/core/aggregateRatio";
import type { ScorecardTile } from "@/shared/kpis/core/scorecardTypes";
import type { MetricsRangeKey as RangeKey } from "@/shared/kpis/core/types";

type Tile = ScorecardTile;

export type ToolUsageDebug = {
  requested_range: string;
  distinct_fiscal_month_count: number;
  distinct_fiscal_months_found: string[];
  selected_month_count: number;
  selected_final_rows: Array<{
    fiscal_end_date: string;
    metric_date: string;
    batch_id: string;
    inserted_at?: string;
    rows_in_month: number;
    tu_eligible_jobs: number | null;
    tu_compliant_jobs: number | null;
    tool_usage_rate: number | null;
  }>;
  trend?: Array<{
    fiscal_end_date: string;
    metric_date: string;
    batch_id: string;
    inserted_at?: string;
    tu_eligible_jobs: number | null;
    tu_compliant_jobs: number | null;
    tool_usage_rate: number | null;
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
    tu_eligible_jobs: number | null;
    tu_compliant_jobs: number | null;
    tool_usage_rate: number | null;
  }>
): string {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) => row.tu_compliant_jobs ?? 0,
    getDenominator: (row) => row.tu_eligible_jobs ?? 0,
  });

  if (agg.denominator > 0) {
    return formatPct(agg.value);
  }

  if (rows.length === 1) {
    return formatPct(rows[0]?.tool_usage_rate ?? null);
  }

  return "—";
}

export function buildToolUsageDrawerModel(args: {
  tile: Tile;
  toolUsageDebug: ToolUsageDebug;
  activeRange: RangeKey;
}) {
  const selectedRows = args.toolUsageDebug?.selected_final_rows ?? [];

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
    getNumerator: (row) => row.tu_compliant_jobs ?? 0,
    getDenominator: (row) => row.tu_eligible_jobs ?? 0,
  });

  const totalEligible = totalAgg.denominator;
  const totalCompliant = totalAgg.numerator;
  const totalRate = computeRangeValue(selectedRows);

  const periodRows = selectedRows.map((row) => {
    const rowAgg = aggregateRatio({
      rows: [row],
      getNumerator: (r) => r.tu_compliant_jobs ?? 0,
      getDenominator: (r) => r.tu_eligible_jobs ?? 0,
    });

    const rowPct =
      rowAgg.denominator > 0
        ? formatPct(rowAgg.value)
        : formatPct(row.tool_usage_rate);

    return {
      key: `${row.fiscal_end_date}-${row.metric_date}-${row.batch_id}`,
      cells: [
        row.metric_date,
        rowPct,
        row.tu_eligible_jobs ?? "—",
        row.tu_compliant_jobs ?? "—",
      ],
    };
  });

  const periodFooter = {
    key: "footer",
    cells: ["TOTAL", totalRate, totalEligible || "—", totalCompliant || "—"],
  };

  return {
    summaryRows,
    chart: (
      <Sparkline
        values={(args.toolUsageDebug?.trend ?? []).map((t) => ({
          kpi_value: t.kpi_value,
          is_month_final: t.is_month_final,
          band_color:
            t.kpi_value != null && t.kpi_value >= 95
              ? "#22c55e"
              : t.kpi_value != null && t.kpi_value >= 90
                ? "#eab308"
                : "#ef4444",
        }))}
      />
    ),
    periodDetail: (
      <MetricPeriodDetailTable
        title="Period Detail"
        columns={[
          { key: "metric_date", label: "Metric Date" },
          {
            key: "tool_usage_pct",
            label: "Tool %",
            align: "right",
            widthClass: "90px",
          },
          {
            key: "eligible",
            label: "Eligible",
            align: "right",
            widthClass: "90px",
          },
          {
            key: "compliant",
            label: "Compliant",
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