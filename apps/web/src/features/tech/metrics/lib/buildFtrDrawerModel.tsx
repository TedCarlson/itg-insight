import Sparkline from "@/shared/components/Sparkline";
import MetricPeriodDetailTable from "@/features/tech/metrics/components/MetricPeriodDetailTable";
import type { ScorecardTile } from "@/shared/kpis/core/scorecardTypes";
import type { MetricsRangeKey as RangeKey } from "@/shared/kpis/core/types";

type Tile = ScorecardTile;

export type FtrDebug = {
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
    total_ftr_contact_jobs: number | null;
    ftr_fail_jobs: number | null;
  }>;
  trend?: Array<{
    fiscal_end_date: string;
    metric_date: string;
    batch_id: string;
    inserted_at?: string;
    kpi_value: number | null;
    is_month_final: boolean;
  }>;
} | null;

function formatPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function computePct(jobs: number, fails: number): number | null {
  if (jobs > 0) return 100 * (1 - fails / jobs);
  if (fails > 0) return 0;
  return null;
}

function computeRangeValue(
  rows: Array<{
    total_ftr_contact_jobs: number | null;
    ftr_fail_jobs: number | null;
  }>
): string {
  const jobs = rows.reduce(
    (sum, row) => sum + (row.total_ftr_contact_jobs ?? 0),
    0
  );
  const fails = rows.reduce(
    (sum, row) => sum + (row.ftr_fail_jobs ?? 0),
    0
  );

  return formatPct(computePct(jobs, fails));
}

export function buildFtrDrawerModel(args: {
  tile: Tile;
  ftrDebug: FtrDebug;
  activeRange: RangeKey;
}) {
  const selectedRows = args.ftrDebug?.selected_final_rows ?? [];

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

  const totalJobs = selectedRows.reduce(
    (sum, row) => sum + (row.total_ftr_contact_jobs ?? 0),
    0
  );
  const totalFails = selectedRows.reduce(
    (sum, row) => sum + (row.ftr_fail_jobs ?? 0),
    0
  );
  const totalFtr = computeRangeValue(selectedRows);

  const periodRows = selectedRows.map((row) => {
    const rowPct = formatPct(
      computePct(row.total_ftr_contact_jobs ?? 0, row.ftr_fail_jobs ?? 0)
    );

    return {
      key: `${row.fiscal_end_date}-${row.metric_date}-${row.batch_id}`,
      cells: [
        row.metric_date,
        rowPct,
        row.total_ftr_contact_jobs ?? "—",
        row.ftr_fail_jobs ?? "—",
      ],
    };
  });

  const periodFooter = {
    key: "footer",
    cells: ["TOTAL", totalFtr, totalJobs || "—", totalFails || "—"],
  };

  return {
    summaryRows,
    chart: (
      <Sparkline
        values={(args.ftrDebug?.trend ?? []).map((t) => ({
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
            key: "ftr_pct",
            label: "FTR %",
            align: "right",
            widthClass: "90px",
          },
          { key: "jobs", label: "Jobs", align: "right", widthClass: "90px" },
          { key: "fails", label: "Fails", align: "right", widthClass: "90px" },
        ]}
        rows={periodRows}
        footer={periodFooter}
      />
    ),
  };
}