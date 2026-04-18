// path: apps/web/src/shared/lib/metrics/scopedComputations.ts

import type {
  MetricsExecutiveKpiItem,
} from "@/shared/types/metrics/executiveStrip";
import type {
  MetricsParticipationSignal,
  MetricsParticipationSignalKpi,
  MetricsRiskInsightKpiMovement,
  MetricsRiskInsights,
  MetricsTopPriorityOverlayRow,
} from "@/shared/types/metrics/surfacePayload";
import type { TeamRowClient } from "./buildScopedRows";

/**
 * Locked convention:
 * - no averages across org-level aggregates
 * - no fabricated KPI math in the client
 *
 * Current scoped executive behavior:
 * - temporary null-safe pass-through only
 * - real scoped strip payload must come from server payload assembly
 */

function isPassBand(bandKey?: string | null) {
  return bandKey === "EXCEEDS" || bandKey === "MEETS";
}

function isFailBand(bandKey?: string | null) {
  return bandKey === "NEEDS_IMPROVEMENT" || bandKey === "MISSES";
}

function isMissBand(bandKey?: string | null) {
  return bandKey === "MISSES";
}

function deriveParticipationBand(score: number) {
  if (score >= 95) return "EXCEEDS";
  if (score >= 85) return "MEETS";
  if (score >= 70) return "NEEDS_IMPROVEMENT";
  return "MISSES";
}

function metricMap(row: TeamRowClient) {
  return new Map(row.metrics.map((metric) => [metric.metric_key, metric]));
}

function filterOverlayRows(
  rows: MetricsTopPriorityOverlayRow[] | undefined,
  scopedTechIds: Set<string>
) {
  return (rows ?? []).filter((row) => scopedTechIds.has(row.tech_id));
}

export function buildScopedExecutiveItems(args: {
  sourceItems?: MetricsExecutiveKpiItem[];
  scopedRows: TeamRowClient[];
  allRows: TeamRowClient[];
}): MetricsExecutiveKpiItem[] {
  void args.scopedRows;
  void args.allRows;
  return [...(args.sourceItems ?? [])];
}

export function buildScopedWorkMix(rows: TeamRowClient[]) {
  let total = 0;
  let installs = 0;
  let tcs = 0;
  let sros = 0;

  rows.forEach((row) => {
    const mix = row.work_mix;
    if (!mix) return;

    total += mix.total ?? 0;
    installs += mix.installs ?? 0;
    tcs += mix.tcs ?? 0;
    sros += mix.sros ?? 0;
  });

  if (total <= 0) return null;

  return {
    total,
    installs,
    tcs,
    sros,
    install_pct: installs / total,
    tc_pct: tcs / total,
    sro_pct: sros / total,
  };
}

function buildScopedParticipationSignal(args: {
  scopedRows: TeamRowClient[];
  priorityKpis: MetricsRiskInsightKpiMovement[];
  sourceSignal?: MetricsParticipationSignal | null;
}): MetricsParticipationSignal | null {
  const eligibleCount = args.scopedRows.length;
  if (!eligibleCount || !args.priorityKpis.length) return null;

  const sourceByKpi = new Map(
    (args.sourceSignal?.by_kpi ?? []).map((item) => [item.kpi_key, item])
  );

  const by_kpi: MetricsParticipationSignalKpi[] = args.priorityKpis.map((kpi) => {
    const participatingCount = args.scopedRows.reduce((sum, row) => {
      const metric = row.metrics.find((item) => item.metric_key === kpi.kpi_key);
      return sum + (isPassBand(metric?.render_band_key) ? 1 : 0);
    }, 0);

    const score = eligibleCount > 0 ? (participatingCount / eligibleCount) * 100 : 0;
    const source = sourceByKpi.get(kpi.kpi_key);

    return {
      kpi_key: kpi.kpi_key,
      label: kpi.label,
      score,
      band_key: deriveParticipationBand(score),
      trend_delta: source?.trend_delta ?? null,
      trend_direction: source?.trend_direction ?? null,
      participating_count: participatingCount,
      eligible_count: eligibleCount,
    };
  });

  const totalScore = by_kpi.reduce((sum, item) => sum + item.score, 0);
  const overallScore = by_kpi.length > 0 ? totalScore / by_kpi.length : 0;
  const sourceOverall = args.sourceSignal ?? null;

  return {
    by_kpi,
    overall_score: overallScore,
    overall_band_key: deriveParticipationBand(overallScore),
    trend_delta: sourceOverall?.trend_delta ?? null,
    trend_direction: sourceOverall?.trend_direction ?? null,
    eligible_count: eligibleCount,
  };
}

export function buildScopedRiskInsights(args: {
  source: MetricsRiskInsights | null | undefined;
  scopedRows: TeamRowClient[];
}): MetricsRiskInsights | null {
  if (!args.source) return null;

  const scopedTechIds = new Set(
    args.scopedRows.map((row) => String(row.tech_id ?? "").trim()).filter(Boolean)
  );

  const prioritySeed =
    args.source.priority_kpis && args.source.priority_kpis.length > 0
      ? args.source.priority_kpis
      : [];

  const scopedPriorityKpis = prioritySeed.map((kpi) => {
    const techIds: string[] = [];

    const missCount = args.scopedRows.reduce((sum, row) => {
      const techId = String(row.tech_id ?? "").trim();
      if (!techId) return sum;

      const metric = row.metrics.find((item) => item.metric_key === kpi.kpi_key);
      if (!isMissBand(metric?.render_band_key)) return sum;

      techIds.push(techId);
      return sum + 1;
    }, 0);

    return {
      ...kpi,
      miss_count: missCount,
      tech_ids: techIds,
    };
  });

  const scopedParticipationSignal = buildScopedParticipationSignal({
    scopedRows: args.scopedRows,
    priorityKpis: scopedPriorityKpis.slice(0, 3),
    sourceSignal: args.source.participation_signal ?? null,
  });

  return {
    ...args.source,
    priority_kpis: scopedPriorityKpis,
    participation_signal: scopedParticipationSignal,
  } as MetricsRiskInsights;
}