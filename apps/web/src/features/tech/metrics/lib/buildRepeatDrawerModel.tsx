import Sparkline from "@/shared/components/Sparkline";
import MetricPeriodDetailTable from "@/features/tech/metrics/components/MetricPeriodDetailTable";
import { aggregateRatio } from "@/shared/kpis/core/aggregateRatio";
import type { ScorecardTile } from "@/shared/kpis/core/scorecardTypes";
import type { MetricsRangeKey as RangeKey } from "@/shared/kpis/core/types";

type Tile = ScorecardTile;

export type RepeatDebug = {
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
    repeat_count: number | null;
    tc_count: number | null;
    repeat_rate: number | null;
  }>;
  trend?: Array<{
    fiscal_end_date: string;
    metric_date: string;
    batch_id: string;
    inserted_at?: string;
    repeat_count: number | null;
    tc_count: number | null;
    repeat_rate: number | null;
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
    tc_count: number | null;
    repeat_count: number | null;
    repeat_rate: number | null;
  }>
): string {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) => row.repeat_count ?? 0,
    getDenominator: (row) => row.tc_count ?? 0,
  });

  if (agg.denominator > 0) {
    return formatPct(agg.value);
  }

  if (rows.length === 1) {
    return formatPct(rows[0]?.repeat_rate ?? null);
  }

  return "—";
}

export function buildRepeatDrawerModel(args: {
  tile: Tile;
  repeatDebug: RepeatDebug;
  activeRange: RangeKey;
}) {
  const selectedRows = args.repeatDebug?.selected_final_rows ?? [];

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
    getNumerator: (row) => row.repeat_count ?? 0,
    getDenominator: (row) => row.tc_count ?? 0,
  });

  const totalTcs = totalAgg.denominator;
  const totalRepeats = totalAgg.numerator;
  const totalRate = computeRangeValue(selectedRows);

  const periodRows = selectedRows.map((row) => {
    const rowAgg = aggregateRatio({
      rows: [row],
      getNumerator: (r) => r.repeat_count ?? 0,
      getDenominator: (r) => r.tc_count ?? 0,
    });

    const rowPct =
      rowAgg.denominator > 0
        ? formatPct(rowAgg.value)
        : formatPct(row.repeat_rate);

    return {
      key: `${row.metric_date}-${row.batch_id ?? "no-batch"}`,
      cells: [
        row.metric_date,
        rowPct,
        row.repeat_count ?? "—",
        row.tc_count ?? "—",
      ],
    };
  });

  const periodFooter = {
    key: "footer",
    cells: ["TOTAL", totalRate, totalRepeats || "—", totalTcs || "—"],
  };

  return {
    summaryRows,
    chart: (
      <Sparkline
        values={(args.repeatDebug?.trend ?? []).map((t) => ({
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
            key: "repeat_pct",
            label: "Repeat %",
            align: "right",
            widthClass: "90px",
          },
          {
            key: "repeats",
            label: "Repeats",
            align: "right",
            widthClass: "90px",
          },
          {
            key: "tcs",
            label: "TCs",
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