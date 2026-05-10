// path: apps/web/src/shared/server/metrics/executive/buildExecutiveAggregateStrip.server.ts

import { buildExecutiveKpis } from "@/shared/domain/metrics/buildExecutiveKpis";
import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";
import type {
  MetricsExecutiveKpiItem,
  MetricsExecutiveRuntimeRubricRow,
  MetricsExecutiveRuntimeScoreRow,
} from "@/shared/types/metrics/executiveStrip";

type BuildExecutiveAggregateStripArgs = {
  payloads: MetricsSurfacePayload[];
  eligible_tech_ids: string[] | Set<string>;
  support?: string | null;
  comparison_scope_code?: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function buildRubricMap(rows: MetricsExecutiveRuntimeRubricRow[]) {
  const map = new Map<string, MetricsExecutiveRuntimeRubricRow[]>();

  for (const row of rows) {
    const key = clean(row.kpi_key);
    if (!key) continue;

    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  return map;
}

function metricRowKey(row: MetricsExecutiveRuntimeScoreRow) {
  return [
    clean(row.tech_id),
    clean(row.metric_key),
    clean(row.numerator),
    clean(row.denominator),
    clean(row.metric_value),
  ].join("::");
}

function dedupeScoreRows(rows: MetricsExecutiveRuntimeScoreRow[]) {
  const seen = new Set<string>();
  const out: MetricsExecutiveRuntimeScoreRow[] = [];

  for (const row of rows) {
    const key = metricRowKey(row);
    if (!key.trim() || seen.has(key)) continue;

    seen.add(key);
    out.push(row);
  }

  return out;
}

export function buildExecutiveAggregateStrip(
  args: BuildExecutiveAggregateStripArgs
): MetricsExecutiveKpiItem[] {
  const eligibleTechIds =
    args.eligible_tech_ids instanceof Set
      ? args.eligible_tech_ids
      : new Set(args.eligible_tech_ids.map(clean).filter(Boolean));

  const runtimes = args.payloads
    .map((payload) => payload.executive_strip?.runtime ?? null)
    .filter(Boolean);

  const firstRuntime = runtimes[0];

  if (!firstRuntime) return [];

  const definitions = firstRuntime.definitions ?? [];

  const rubricRows = dedupeScoreRows([]) && runtimes.flatMap((runtime) => {
    return runtime?.rubric_rows ?? [];
  });

  const rubricByKpi = buildRubricMap(rubricRows);

  const allCurrentRows = dedupeScoreRows(
    runtimes.flatMap((runtime) => runtime?.current_rows ?? [])
  );

  const aggregateRows = allCurrentRows.filter((row) =>
    eligibleTechIds.has(clean(row.tech_id))
  );

  if (!aggregateRows.length) return [];

  return buildExecutiveKpis({
    definitions: definitions as any,
    supervisorScores: aggregateRows as any,
    orgScores: allCurrentRows as any,
    rubricByKpi: rubricByKpi as any,
    support: args.support ?? null,
    comparison_scope_code: args.comparison_scope_code ?? "SCOPE",
  }) as MetricsExecutiveKpiItem[];
}

export default buildExecutiveAggregateStrip;