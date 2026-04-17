// path: apps/web/src/shared/server/metrics/buildRiskState.ts

import type {
  MetricsRiskInsightPerformer,
  MetricsRiskInsights,
  MetricsRiskStripItem,
  MetricsSurfaceTeamCell,
} from "@/shared/types/metrics/surfacePayload";

type DefinitionRow = {
  profile_key: string;
  kpi_key: string;
  label: string;
  customer_label: string;
  raw_label_identifier: string;
  direction: string | null;
  sort_order: number;
  report_order: number | null;
  weight: number | null;
};

function resolveFtrKpiKey(definitions: DefinitionRow[]): string | null {
  const exact = definitions.find((def) => def.kpi_key === "ftr_rate");
  if (exact) return exact.kpi_key;

  const fuzzy = definitions.find((def) => {
    const key = def.kpi_key.toLowerCase();
    const label = (def.label ?? "").toLowerCase();
    const customerLabel = (def.customer_label ?? "").toLowerCase();

    return (
      key.includes("ftr") ||
      label.includes("ftr") ||
      customerLabel.includes("ftr")
    );
  });

  return fuzzy?.kpi_key ?? null;
}

function hasPositiveFtrContactJobs(args: {
  tech_id: string;
  ftrKpiKey: string | null;
  scoreMap: Map<string, MetricsSurfaceTeamCell[]>;
}): boolean {
  if (!args.ftrKpiKey) return true;

  const metrics = args.scoreMap.get(args.tech_id) ?? [];
  const ftrMetric =
    metrics.find((metric) => metric.metric_key === args.ftrKpiKey) ?? null;

  const denominator = ftrMetric?.denominator;
  return typeof denominator === "number" && Number.isFinite(denominator)
    ? denominator > 0
    : false;
}

function compareByRankThenComposite(
  a: {
    rank: number | null;
    composite_score: number | null;
    full_name: string | null;
  },
  b: {
    rank: number | null;
    composite_score: number | null;
    full_name: string | null;
  }
) {
  const rankA =
    typeof a.rank === "number" && Number.isFinite(a.rank) ? a.rank : 999999;
  const rankB =
    typeof b.rank === "number" && Number.isFinite(b.rank) ? b.rank : 999999;

  if (rankA !== rankB) return rankA - rankB;

  const compA =
    typeof a.composite_score === "number" && Number.isFinite(a.composite_score)
      ? a.composite_score
      : -1;
  const compB =
    typeof b.composite_score === "number" && Number.isFinite(b.composite_score)
      ? b.composite_score
      : -1;

  if (compA !== compB) return compB - compA;

  return String(a.full_name ?? "").localeCompare(String(b.full_name ?? ""));
}

export function buildRiskState(args: {
  teamRows: Array<{
    tech_id: string;
    full_name: string | null;
    rank: number | null;
    composite_score: number | null;
  }>;
  definitions: DefinitionRow[];
  scoreMap: Map<string, MetricsSurfaceTeamCell[]>;
  workMixMap: Map<
    string,
    {
      total: number;
      installs: number;
      tcs: number;
      sros: number;
    }
  >;
}) {
  const riskCountByTech = new Map<string, number>();

  function isFail(band: string | null | undefined) {
    return band === "NEEDS_IMPROVEMENT" || band === "MISSES";
  }

  function isPass(band: string | null | undefined) {
    return band === "MEETS" || band === "EXCEEDS";
  }

  function isMiss(band: string | null | undefined) {
    return band === "MISSES";
  }

  const scopedDefinitions = [...args.definitions]
    .filter((def) => (def.weight ?? 0) > 0)
    .sort((a, b) => {
      const ao = a.report_order ?? 999;
      const bo = b.report_order ?? 999;
      if (ao !== bo) return ao - bo;
      return a.kpi_key.localeCompare(b.kpi_key);
    })
    .slice(0, 3);

  const scopedKpiKeys = new Set(scopedDefinitions.map((def) => def.kpi_key));

  const labelByKpi = new Map(
    args.definitions.map((def) => [def.kpi_key, def.customer_label || def.label])
  );

  const ftrKpiKey = resolveFtrKpiKey(args.definitions);

  const eligibleTeamRows = args.teamRows.filter((row) =>
    hasPositiveFtrContactJobs({
      tech_id: row.tech_id,
      ftrKpiKey,
      scoreMap: args.scoreMap,
    })
  );

  const techScopedPassMap = new Map<string, string[]>();
  const techScopedFailMap = new Map<string, string[]>();
  const kpiMissMap = new Map<string, string[]>();

  for (const row of eligibleTeamRows) {
    const techId = row.tech_id;
    const metrics = args.scoreMap.get(techId) ?? [];

    let totalRiskCount = 0;
    const scopedPassedKpis: string[] = [];
    const scopedFailedKpis: string[] = [];

    for (const metric of metrics) {
      if (isFail(metric.band_key)) {
        totalRiskCount += 1;
      }

      if (!scopedKpiKeys.has(metric.metric_key)) continue;

      if (isPass(metric.band_key)) {
        scopedPassedKpis.push(metric.metric_key);
      } else if (isFail(metric.band_key)) {
        scopedFailedKpis.push(metric.metric_key);
      }

      if (isMiss(metric.band_key)) {
        const list = kpiMissMap.get(metric.metric_key) ?? [];
        list.push(techId);
        kpiMissMap.set(metric.metric_key, list);
      }
    }

    techScopedPassMap.set(techId, scopedPassedKpis);
    techScopedFailMap.set(techId, scopedFailedKpis);
    riskCountByTech.set(techId, totalRiskCount);
  }

  const priorityKpis = [...kpiMissMap.entries()]
    .filter(([kpiKey]) => scopedKpiKeys.has(kpiKey))
    .map(([kpiKey, techIds]) => ({
      kpi_key: kpiKey,
      label: labelByKpi.get(kpiKey) ?? kpiKey,
      miss_count: techIds.length,
      tech_ids: techIds,
    }))
    .sort((a, b) => {
      if (b.miss_count !== a.miss_count) return b.miss_count - a.miss_count;
      return a.kpi_key.localeCompare(b.kpi_key);
    });

  const topKpi = priorityKpis[0] ?? null;
  const topKpiCount = topKpi?.miss_count ?? 0;

  let meets3 = 0;
  let meets2 = 0;
  let meets1 = 0;
  let meets0 = 0;

  const meets3TechIds: string[] = [];
  const meets2TechIds: string[] = [];
  const meets1TechIds: string[] = [];
  const meets0TechIds: string[] = [];

  for (const row of eligibleTeamRows) {
    const passCount = techScopedPassMap.get(row.tech_id)?.length ?? 0;

    if (passCount >= 3) {
      meets3 += 1;
      meets3TechIds.push(row.tech_id);
    } else if (passCount === 2) {
      meets2 += 1;
      meets2TechIds.push(row.tech_id);
    } else if (passCount === 1) {
      meets1 += 1;
      meets1TechIds.push(row.tech_id);
    } else {
      meets0 += 1;
      meets0TechIds.push(row.tech_id);
    }
  }

  const sortedByRank = [...args.teamRows].sort(compareByRankThenComposite);

  function toPerformer(row: {
    tech_id: string;
    full_name: string | null;
    rank: number | null;
    composite_score: number | null;
  }): MetricsRiskInsightPerformer {
    const failed = techScopedFailMap.get(row.tech_id) ?? [];
    const primaryKpiKey = failed[0] ?? null;

    return {
      tech_id: row.tech_id,
      full_name: row.full_name,
      rank: row.rank,
      composite_score: row.composite_score,
      risk_count: riskCountByTech.get(row.tech_id) ?? 0,
      streak_count: null,
      primary_kpi_key: primaryKpiKey,
      primary_kpi_label: primaryKpiKey
        ? labelByKpi.get(primaryKpiKey) ?? primaryKpiKey
        : null,
    };
  }

  const topPerformers = sortedByRank.slice(0, 5).map(toPerformer);
  const bottomPerformers = [...sortedByRank].reverse().slice(0, 5).map(toPerformer);

  const strip: MetricsRiskStripItem[] = [
    {
      key: "top_kpi",
      title: "Top Risk KPI",
      value: topKpi?.label ?? "—",
      note: `${topKpiCount} techs`,
    },
    {
      key: "participation",
      title: "Participation",
      value: `${meets3}/${eligibleTeamRows.length}`,
      note: "Meets all KPIs",
    },
    {
      key: "top",
      title: "Top Performers",
      value: String(topPerformers.length),
      note: "Highest rank",
    },
    {
      key: "bottom",
      title: "Needs Attention",
      value: String(bottomPerformers.length),
      note: "Lowest rank",
    },
  ];

  const insights: MetricsRiskInsights = {
    top_priority_kpi: {
      kpi_key: topKpi?.kpi_key ?? null,
      label: topKpi?.label ?? null,
      miss_count: topKpi?.miss_count ?? 0,
      tech_ids: topKpi?.tech_ids ?? [],
      new_tech_ids: [],
      persistent_tech_ids: [],
      recovered_tech_ids: [],
    },
    priority_kpis: priorityKpis.map((kpi) => ({
      kpi_key: kpi.kpi_key,
      label: kpi.label,
      miss_count: kpi.miss_count,
      tech_ids: kpi.tech_ids,
      new_tech_ids: [],
      persistent_tech_ids: [],
      recovered_tech_ids: [],
    })),
    participation: {
      meets_3: {
        count: meets3,
        tech_ids: meets3TechIds,
      },
      meets_2: {
        count: meets2,
        tech_ids: meets2TechIds,
      },
      meets_1: {
        count: meets1,
        tech_ids: meets1TechIds,
      },
      meets_0: {
        count: meets0,
        tech_ids: meets0TechIds,
      },
    },
    top_performers: topPerformers,
    bottom_performers: bottomPerformers,
  };

  return {
    riskCountByTech,
    strip,
    insights,
    scopedKpiKeys,
  };
}