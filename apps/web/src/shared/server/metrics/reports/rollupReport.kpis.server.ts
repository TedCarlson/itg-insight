// path: apps/web/src/shared/server/metrics/reports/rollupReport.kpis.server.ts

import { buildScopedExecutiveStrip } from "@/shared/lib/metrics/buildScopedExecutiveStrip";
import type { TeamRowClient } from "@/shared/lib/metrics/buildScopedRows";
import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";

export type RollupReportKpi = {
  kpi_key: string;
  label: string;
  value: number | null;
  value_display: string;
  band_key: string | null;
  weighted_points: number | null;
};

type MetricFactRow = {
  tech_id: string;
  metric_key: string;
  metric_value: number | null;
  band_key: string | null;
  weighted_points: number | null;
  numerator: number | null;
  denominator: number | null;
};

type RuntimeDefinition = {
  kpi_key?: string | null;
  label?: string | null;
  customer_label?: string | null;
  weight?: number | null;
};

export function readNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,%]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function sum(values: Array<number | null | undefined>): number | null {
  const nums = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value)
  );

  if (!nums.length) return null;

  return nums.reduce((total, value) => total + value, 0);
}

function getMetricRows(
  rows: TeamRowClient[],
  kpiKey: string
): MetricFactRow[] {
  return rows
    .map<MetricFactRow | null>((row) => {
      const techId = String(row.tech_id ?? "").trim();

      const metric = (row.metrics ?? []).find(
        (item) => item.metric_key === kpiKey
      );

      if (!techId || !metric) {
        return null;
      }

      return {
        tech_id: techId,
        metric_key: kpiKey,
        metric_value: readNumeric(metric.metric_value),
        band_key: metric.render_band_key ?? null,
        weighted_points: readNumeric(metric.weighted_points),
        numerator: readNumeric(metric.numerator) ?? null,
        denominator: readNumeric(metric.denominator) ?? null,
      };
    })
    .filter(
      (row): row is MetricFactRow => row !== null
    );
}

function computeTnpsValue(rows: MetricFactRow[]): number | null {
  const totalPromoters = sum(rows.map((row) => row.numerator));
  const totalSurveys = sum(rows.map((row) => row.denominator));

  if (
    totalPromoters == null ||
    totalSurveys == null ||
    !Number.isFinite(totalPromoters) ||
    !Number.isFinite(totalSurveys) ||
    totalSurveys <= 0
  ) {
    return null;
  }

  let totalDetractors = 0;

  for (const row of rows) {
    if (
      typeof row.metric_value === "number" &&
      Number.isFinite(row.metric_value) &&
      typeof row.denominator === "number" &&
      Number.isFinite(row.denominator) &&
      row.denominator > 0
    ) {
      const rowPromoters =
        typeof row.numerator === "number" && Number.isFinite(row.numerator)
          ? row.numerator
          : 0;

      const derivedDetractors =
        (((rowPromoters / row.denominator) * 100 - row.metric_value) *
          row.denominator) /
        100;

      if (Number.isFinite(derivedDetractors)) {
        totalDetractors += Math.max(0, derivedDetractors);
      }
    }
  }

  return ((totalPromoters - totalDetractors) / totalSurveys) * 100;
}

function computeAggregateKpiValue(rows: MetricFactRow[], kpiKey: string) {
  if (!rows.length) return null;

  if (kpiKey === "tnps_score") {
    return computeTnpsValue(rows);
  }

  const numerator = sum(rows.map((row) => row.numerator));
  const denominator = sum(rows.map((row) => row.denominator));

  if (
    numerator != null &&
    denominator != null &&
    Number.isFinite(numerator) &&
    Number.isFinite(denominator) &&
    denominator > 0
  ) {
    return (numerator / denominator) * 100;
  }

  return null;
}

function getDefinition(args: {
  payload: MetricsSurfacePayload;
  kpiKey: string;
}): RuntimeDefinition | null {
  const definitions = (args.payload.executive_strip?.runtime?.definitions ??
    []) as RuntimeDefinition[];

  return (
    definitions.find(
      (definition) =>
        String(definition.kpi_key ?? "").trim() === args.kpiKey
    ) ?? null
  );
}

function inferWeightFromRows(rows: MetricFactRow[]): number | null {
  const points = rows
    .map((row) => readNumeric(row.weighted_points))
    .filter((value): value is number => value !== null);

  if (!points.length) return null;

  return Math.max(...points);
}

/**
 * Composite rule:
 * - Do not average tech composites.
 * - Do not average tech weighted points.
 * - Recompute aggregate KPI value from numerator/denominator facts.
 * - Score aggregate KPI value into weighted points.
 *
 * NOTE:
 * The canonical runtime currently does not expose the score curve directly here.
 * This uses the KPI weight when available, otherwise infers the enabled KPI
 * weight from the fact rows. This keeps composite based on aggregate KPI facts,
 * not on averaged tech composite scores.
 */
function computeAggregateWeightedPoints(args: {
  payload: MetricsSurfacePayload;
  kpiKey: string;
  aggregateValue: number | null;
  factRows: MetricFactRow[];
}): number | null {
  if (
    args.aggregateValue == null ||
    !Number.isFinite(args.aggregateValue)
  ) {
    return null;
  }

  const definition = getDefinition({
    payload: args.payload,
    kpiKey: args.kpiKey,
  });

  const definitionWeight = readNumeric(definition?.weight);
  const inferredWeight = inferWeightFromRows(args.factRows);
  const weight = definitionWeight ?? inferredWeight;

  if (weight == null || !Number.isFinite(weight) || weight <= 0) {
    return null;
  }

  const normalizedValue = Math.max(0, Math.min(100, args.aggregateValue));
  return roundScore((normalizedValue / 100) * weight);
}

export function computeComposite(kpis: RollupReportKpi[]): number | null {
  const points = kpis
    .map((kpi) => readNumeric(kpi.weighted_points))
    .filter((value): value is number => value !== null);

  if (!points.length) return null;

  return roundScore(points.reduce((total, value) => total + value, 0));
}

export function buildKpis(args: {
  payload: MetricsSurfacePayload;
  rows: TeamRowClient[];
  visibleKpiKeys: string[];
}): RollupReportKpi[] {
  const exec = buildScopedExecutiveStrip({
    runtime: args.payload.executive_strip?.runtime ?? null,
    scopedRows: args.rows,
    fallbackItems: args.payload.executive_strip?.scope?.items ?? [],
  });

  return args.visibleKpiKeys.map((kpiKey) => {
    const item = exec.find((candidate: any) => candidate.kpi_key === kpiKey);
    const rawItem = item as any;

    const factRows = getMetricRows(args.rows, kpiKey);
    const aggregateValue = computeAggregateKpiValue(factRows, kpiKey);

    return {
      kpi_key: kpiKey,
      label: rawItem?.label ?? kpiKey,
      value: aggregateValue,
      value_display: rawItem?.value_display ?? "—",
      band_key: rawItem?.band_key ?? null,
      weighted_points: computeAggregateWeightedPoints({
        payload: args.payload,
        kpiKey,
        aggregateValue,
        factRows,
      }),
    };
  });
}