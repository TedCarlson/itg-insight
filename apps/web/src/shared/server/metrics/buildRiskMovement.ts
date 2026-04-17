// path: apps/web/src/shared/server/metrics/buildRiskMovement.ts

import { loadMetricScoreRows } from "@/shared/server/metrics/loadMetricScoreRows.server";
import { dedupeLatestScoreRows } from "@/shared/server/metrics/lib/metricRowDedupers";
import type { MetricsRiskInsightKpiMovement } from "@/shared/types/metrics/surfacePayload";

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

function isMissBand(bandKey: string | null | undefined) {
  return bandKey === "MISSES";
}

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
  if (!args.ftrKpiKey) {
    return new Set(
      dedupeLatestScoreRows(args.scoreRows)
        .map((row) => row.tech_id)
        .filter(Boolean)
    );
  }

  const latestRows = dedupeLatestScoreRows(args.scoreRows);
  const eligible = new Set<string>();

  for (const row of latestRows) {
    if (row.metric_key !== args.ftrKpiKey) continue;

    const denominator = row.denominator;
    if (
      typeof denominator === "number" &&
      Number.isFinite(denominator) &&
      denominator > 0
    ) {
      eligible.add(row.tech_id);
    }
  }

  return eligible;
}

function buildMissSetByTech(args: {
  scoreRows: Awaited<ReturnType<typeof loadMetricScoreRows>>;
  eligibleTechIds: Set<string>;
  scopedKpiKeys?: Set<string>;
}): Map<string, Set<string>> {
  const latestRows = dedupeLatestScoreRows(args.scoreRows);
  const out = new Map<string, Set<string>>();

  for (const row of latestRows) {
    if (!args.eligibleTechIds.has(row.tech_id)) continue;
    if (args.scopedKpiKeys && !args.scopedKpiKeys.has(row.metric_key)) continue;
    if (!isMissBand(row.band_key)) continue;

    const set = out.get(row.tech_id) ?? new Set<string>();
    set.add(row.metric_key);
    out.set(row.tech_id, set);
  }

  return out;
}

export function buildRiskMovement(args: {
  definitions: DefinitionRow[];
  currentScoreRows: Awaited<ReturnType<typeof loadMetricScoreRows>>;
  previousScoreRows: Awaited<ReturnType<typeof loadMetricScoreRows>>;
  topKpiKey: string | null;
  currentTechIds: string[];
}) {
  if (!args.topKpiKey) {
    return {
      new_tech_ids: [],
      persistent_tech_ids: [],
      recovered_tech_ids: [],
    };
  }

  const ftrKpiKey = resolveFtrKpiKey(args.definitions);

  const currentEligibleTechIds = buildEligibleTechIdSet({
    scoreRows: args.currentScoreRows,
    ftrKpiKey,
  });

  const previousEligibleTechIds = buildEligibleTechIdSet({
    scoreRows: args.previousScoreRows,
    ftrKpiKey,
  });

  const currentMissSetByTech = buildMissSetByTech({
    scoreRows: args.currentScoreRows,
    eligibleTechIds: currentEligibleTechIds,
  });

  const previousMissSetByTech = buildMissSetByTech({
    scoreRows: args.previousScoreRows,
    eligibleTechIds: previousEligibleTechIds,
  });

  const currentTechIds: string[] = [];
  for (const [techId, kpis] of currentMissSetByTech.entries()) {
    if (kpis.has(args.topKpiKey)) {
      currentTechIds.push(techId);
    }
  }
  currentTechIds.sort((a, b) => a.localeCompare(b));

  const previousTechIds = new Set<string>();
  for (const [techId, kpis] of previousMissSetByTech.entries()) {
    if (kpis.has(args.topKpiKey)) {
      previousTechIds.add(techId);
    }
  }

  const currentTechIdSet = new Set(currentTechIds);

  const persistent_tech_ids = currentTechIds.filter((techId) =>
    previousTechIds.has(techId)
  );

  const new_tech_ids = currentTechIds.filter(
    (techId) => !previousTechIds.has(techId)
  );

  const recovered_tech_ids = [...previousTechIds]
    .filter((techId) => !currentTechIdSet.has(techId))
    .sort((a, b) => a.localeCompare(b));

  return {
    new_tech_ids,
    persistent_tech_ids,
    recovered_tech_ids,
  };
}

export function buildPriorityKpiMovements(args: {
  definitions: DefinitionRow[];
  currentScoreRows: Awaited<ReturnType<typeof loadMetricScoreRows>>;
  previousScoreRows: Awaited<ReturnType<typeof loadMetricScoreRows>>;
  priorityKpis: Array<{
    kpi_key: string;
    label: string;
    miss_count: number;
    tech_ids: string[];
  }>;
}): MetricsRiskInsightKpiMovement[] {
  return args.priorityKpis.map((kpi) => {
    const movement = buildRiskMovement({
      definitions: args.definitions,
      currentScoreRows: args.currentScoreRows,
      previousScoreRows: args.previousScoreRows,
      topKpiKey: kpi.kpi_key,
      currentTechIds: kpi.tech_ids,
    });

    return {
      kpi_key: kpi.kpi_key,
      label: kpi.label,
      miss_count: kpi.miss_count,
      tech_ids: kpi.tech_ids,
      new_tech_ids: movement.new_tech_ids,
      persistent_tech_ids: movement.persistent_tech_ids,
      recovered_tech_ids: movement.recovered_tech_ids,
    };
  });
}