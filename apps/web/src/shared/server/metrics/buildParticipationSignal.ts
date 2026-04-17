// path: apps/web/src/shared/server/metrics/buildParticipationSignal.ts

import { loadMetricScoreRows } from "@/shared/server/metrics/loadMetricScoreRows.server";
import { dedupeLatestScoreRows } from "@/shared/server/metrics/lib/metricRowDedupers";
import type {
  MetricsParticipationSignal,
  MetricsRiskTrendDirection,
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

function buildEligibleTechIdSet(args: {
  scoreRows: Awaited<ReturnType<typeof loadMetricScoreRows>>;
  ftrKpiKey: string | null;
}): Set<string> {
  const latestRows = dedupeLatestScoreRows(args.scoreRows);

  if (!args.ftrKpiKey) {
    return new Set(latestRows.map((row) => row.tech_id).filter(Boolean));
  }

  const out = new Set<string>();

  for (const row of latestRows) {
    if (row.metric_key !== args.ftrKpiKey) continue;

    const denominator = row.denominator;
    if (
      typeof denominator === "number" &&
      Number.isFinite(denominator) &&
      denominator > 0
    ) {
      out.add(row.tech_id);
    }
  }

  return out;
}

function buildParticipationRateByKpi(args: {
  scoreRows: Awaited<ReturnType<typeof loadMetricScoreRows>>;
  eligibleTechIds: Set<string>;
  scopedDefinitions: DefinitionRow[];
}): Map<string, { rate: number; participating_count: number; eligible_count: number }> {
  const latestRows = dedupeLatestScoreRows(args.scoreRows);
  const presentByKpi = new Map<string, Set<string>>();

  for (const def of args.scopedDefinitions) {
    presentByKpi.set(def.kpi_key, new Set<string>());
  }

  for (const row of latestRows) {
    if (!args.eligibleTechIds.has(row.tech_id)) continue;
    if (!presentByKpi.has(row.metric_key)) continue;

    const denominator = row.denominator;
    if (
      typeof denominator === "number" &&
      Number.isFinite(denominator) &&
      denominator > 0
    ) {
      presentByKpi.get(row.metric_key)?.add(row.tech_id);
    }
  }

  const eligibleCount = args.eligibleTechIds.size;
  const out = new Map<
    string,
    { rate: number; participating_count: number; eligible_count: number }
  >();

  for (const def of args.scopedDefinitions) {
    const participatingCount = presentByKpi.get(def.kpi_key)?.size ?? 0;
    const rate =
      eligibleCount > 0 ? (participatingCount / eligibleCount) * 100 : 0;

    out.set(def.kpi_key, {
      rate,
      participating_count: participatingCount,
      eligible_count: eligibleCount,
    });
  }

  return out;
}

function resolveBandKey(score: number): string {
  if (score >= 95) return "EXCEEDS";
  if (score >= 85) return "MEETS";
  if (score >= 70) return "NEEDS_IMPROVEMENT";
  return "MISSES";
}

function resolveTrendDirection(
  currentValue: number | null,
  previousValue: number | null
): MetricsRiskTrendDirection {
  if (
    typeof currentValue !== "number" ||
    !Number.isFinite(currentValue) ||
    typeof previousValue !== "number" ||
    !Number.isFinite(previousValue)
  ) {
    return null;
  }

  const delta = currentValue - previousValue;
  if (Math.abs(delta) < 0.05) return "flat";
  return delta > 0 ? "up" : "down";
}

export function buildParticipationSignal(args: {
  definitions: DefinitionRow[];
  currentScoreRows: Awaited<ReturnType<typeof loadMetricScoreRows>>;
  previousScoreRows: Awaited<ReturnType<typeof loadMetricScoreRows>>;
}): MetricsParticipationSignal | null {
  const scopedDefinitions = [...args.definitions]
    .filter((def) => (def.weight ?? 0) > 0)
    .sort((a, b) => {
      const ao = a.report_order ?? 999;
      const bo = b.report_order ?? 999;
      if (ao !== bo) return ao - bo;
      return a.kpi_key.localeCompare(b.kpi_key);
    })
    .slice(0, 3);

  if (!scopedDefinitions.length) return null;

  const ftrKpiKey = resolveFtrKpiKey(args.definitions);

  const currentEligibleTechIds = buildEligibleTechIdSet({
    scoreRows: args.currentScoreRows,
    ftrKpiKey,
  });

  const previousEligibleTechIds = buildEligibleTechIdSet({
    scoreRows: args.previousScoreRows,
    ftrKpiKey,
  });

  const currentRateByKpi = buildParticipationRateByKpi({
    scoreRows: args.currentScoreRows,
    eligibleTechIds: currentEligibleTechIds,
    scopedDefinitions,
  });

  const previousRateByKpi = buildParticipationRateByKpi({
    scoreRows: args.previousScoreRows,
    eligibleTechIds: previousEligibleTechIds,
    scopedDefinitions,
  });

  const by_kpi = scopedDefinitions.map((def) => {
    const current = currentRateByKpi.get(def.kpi_key) ?? {
      rate: 0,
      participating_count: 0,
      eligible_count: currentEligibleTechIds.size,
    };
    const previous = previousRateByKpi.get(def.kpi_key) ?? {
      rate: 0,
      participating_count: 0,
      eligible_count: previousEligibleTechIds.size,
    };

    const trendDelta =
      typeof previous.rate === "number" ? current.rate - previous.rate : null;

    return {
      kpi_key: def.kpi_key,
      label: def.customer_label || def.label,
      score: current.rate,
      band_key: resolveBandKey(current.rate),
      trend_delta:
        typeof trendDelta === "number" && Number.isFinite(trendDelta)
          ? trendDelta
          : null,
      trend_direction: resolveTrendDirection(current.rate, previous.rate),
      participating_count: current.participating_count,
      eligible_count: current.eligible_count,
    };
  });

  const totalWeight = scopedDefinitions.reduce((sum, def) => {
    return sum + (def.weight ?? 0);
  }, 0);

  const overallScore =
    totalWeight > 0
      ? scopedDefinitions.reduce((sum, def) => {
          const current = currentRateByKpi.get(def.kpi_key)?.rate ?? 0;
          const weight = def.weight ?? 0;
          return sum + current * weight;
        }, 0) / totalWeight
      : 0;

  const previousOverallScore =
    totalWeight > 0
      ? scopedDefinitions.reduce((sum, def) => {
          const previous = previousRateByKpi.get(def.kpi_key)?.rate ?? 0;
          const weight = def.weight ?? 0;
          return sum + previous * weight;
        }, 0) / totalWeight
      : 0;

  const overallTrendDelta = overallScore - previousOverallScore;

  return {
    by_kpi,
    overall_score: overallScore,
    overall_band_key: resolveBandKey(overallScore),
    trend_delta:
      typeof overallTrendDelta === "number" && Number.isFinite(overallTrendDelta)
        ? overallTrendDelta
        : null,
    trend_direction: resolveTrendDirection(overallScore, previousOverallScore),
    eligible_count: currentEligibleTechIds.size,
  };
}