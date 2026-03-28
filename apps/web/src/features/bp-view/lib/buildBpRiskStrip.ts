import { sortWorkforceRows } from "@/shared/kpis/core/sortWorkforceRows";
import type { BpViewRiskItem, BpViewRosterRow } from "./bpView.types";

type KpiCfg = {
  kpi_key: string;
  label: string;
  sort: number;
};

function hasMetricValue(row: BpViewRosterRow) {
  return row.metrics.some((metric) => metric.value != null);
}

function hasPositiveJobs(row: BpViewRosterRow) {
  return (row.work_mix?.total ?? 0) > 0;
}

function hasVisibleData(row: BpViewRosterRow) {
  return hasPositiveJobs(row) || hasMetricValue(row);
}

export function buildBpRiskStrip(args: {
  rosterRows: BpViewRosterRow[];
  kpis: KpiCfg[];
}): BpViewRiskItem[] {
  const eligibleRows = args.rosterRows.filter(hasVisibleData);

  const belowThresholdCount = eligibleRows.filter(
    (row) => row.below_target_count >= 2
  ).length;

  const coachingQueue = eligibleRows.filter(
    (row) => row.below_target_count >= 1
  ).length;

  const kpiConcernCounts = new Map<string, number>();
  for (const kpi of args.kpis) {
    kpiConcernCounts.set(kpi.kpi_key, 0);
  }

  for (const row of eligibleRows) {
    for (const metric of row.metrics) {
      if (
        metric.band_key === "NEEDS_IMPROVEMENT" ||
        metric.band_key === "MISSES"
      ) {
        kpiConcernCounts.set(
          metric.kpi_key,
          (kpiConcernCounts.get(metric.kpi_key) ?? 0) + 1
        );
      }
    }
  }

  const topConcern = [...kpiConcernCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];

    const aIndex = args.kpis.findIndex((kpi) => kpi.kpi_key === a[0]);
    const bIndex = args.kpis.findIndex((kpi) => kpi.kpi_key === b[0]);
    return aIndex - bIndex;
  })[0];

  const topConcernLabel =
    args.kpis.find((kpi) => kpi.kpi_key === topConcern?.[0])?.label ?? "—";
  const topConcernCount = topConcern?.[1] ?? 0;

  const strongestStanding =
    sortWorkforceRows(
      eligibleRows,
      args.kpis.map((kpi) => ({
        kpi_key: kpi.kpi_key,
        label: kpi.label,
      }))
    )[0]?.full_name ?? "—";

  return [
    {
      title: "Below Threshold",
      value: String(belowThresholdCount),
      note: "Techs below target on 2+ KPIs",
    },
    {
      title: "Coaching Queue",
      value: String(coachingQueue),
      note: "Techs with at least 1 KPI needing attention",
    },
    {
      title: "Top Concern",
      value: topConcernLabel,
      note: `${topConcernCount} KPI flags in scope`,
    },
    {
      title: "Strongest Standing",
      value: strongestStanding,
      note: "Best current KPI standing in scope",
    },
  ];
}