// path: apps/web/src/shared/domain/metrics/buildExecutiveKpis.ts

import type { LoadedKpiConfigItem } from "@/shared/kpis/engine/loadKpiConfig.server";
import type { LoadedKpiRubricRow } from "@/shared/kpis/engine/loadKpiRubric.server";
import type {
  MetricsExecutiveComparisonState,
  MetricsExecutiveKpiItem,
} from "@/shared/types/metrics/executiveStrip";
import { normalizeBandKey } from "@/shared/bands";

export type ScoreRow = {
  tech_id: string;
  metric_key: string;
  metric_value: number | null;
  band_key?: string | null;
  weighted_points?: number | null;
  numerator?: number | null;
  denominator?: number | null;
};

type BandKey =
  | "EXCEEDS"
  | "MEETS"
  | "NEEDS_IMPROVEMENT"
  | "MISSES"
  | "NO_DATA";

export type BuildExecutiveKpisArgs = {
  definitions: LoadedKpiConfigItem[];

  // current shared builder shape
  scopeScores?: ScoreRow[];
  comparisonScores?: ScoreRow[];

  // backward-compatible caller shape still used elsewhere
  supervisorScores?: ScoreRow[];
  orgScores?: ScoreRow[];

  rubricByKpi: Map<string, LoadedKpiRubricRow[]>;
  support?: string | null;
  comparison_scope_code: string;
};

function resolveScope(args: BuildExecutiveKpisArgs): ScoreRow[] {
  return args.scopeScores ?? args.supervisorScores ?? [];
}

function resolveComparisonRows(args: BuildExecutiveKpisArgs): ScoreRow[] {
  return args.comparisonScores ?? args.orgScores ?? [];
}

function sum(values: Array<number | null | undefined>): number | null {
  const nums = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function format(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bandLabel(bandKey: BandKey): string {
  if (bandKey === "EXCEEDS") return "Exceeds";
  if (bandKey === "MEETS") return "Meets";
  if (bandKey === "NEEDS_IMPROVEMENT") return "Needs Improvement";
  if (bandKey === "MISSES") return "Misses";
  return "No Data";
}

function getRubricRows(
  rubricByKpi: Map<string, LoadedKpiRubricRow[]>,
  kpiKey: string
): LoadedKpiRubricRow[] {
  return rubricByKpi.get(kpiKey) ?? [];
}

function hasAnyData(rows: ScoreRow[]): boolean {
  return rows.some(
    (row) =>
      (typeof row.metric_value === "number" && Number.isFinite(row.metric_value)) ||
      (typeof row.numerator === "number" && Number.isFinite(row.numerator)) ||
      (typeof row.denominator === "number" && Number.isFinite(row.denominator))
  );
}

function computeTnpsValue(rows: ScoreRow[]): number | null {
  const totalPromoters = sum(rows.map((r) => r.numerator));
  const totalSurveys = sum(rows.map((r) => r.denominator));

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

function computeKpiValue(rows: ScoreRow[], metricKey: string): number | null {
  if (!rows.length) return null;

  if (metricKey === "tnps_score") {
    return computeTnpsValue(rows);
  }

  const numerator = sum(rows.map((r) => r.numerator));
  const denominator = sum(rows.map((r) => r.denominator));

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

function resolveBandFromRubric(args: {
  rows: ScoreRow[];
  value: number | null;
  rubricRows: LoadedKpiRubricRow[];
}): BandKey {
  if (!hasAnyData(args.rows)) {
    return "NO_DATA";
  }

  if (args.value == null || !Number.isFinite(args.value)) {
    return "NO_DATA";
  }

  const normalizedRows = args.rubricRows
    .map((row) => ({
      band_key: normalizeBandKey(String((row as any).band_key ?? null)) as BandKey,
      min_value: toNullableNumber((row as any).min_value),
      max_value: toNullableNumber((row as any).max_value),
    }))
    .filter((row) => row.band_key !== "NO_DATA");

  for (const row of normalizedRows) {
    const meetsMin = row.min_value == null || args.value >= row.min_value;
    const meetsMax = row.max_value == null || args.value <= row.max_value;

    if (meetsMin && meetsMax) {
      return row.band_key;
    }
  }

  return "NO_DATA";
}

function resolveComparisonState(
  scopeValue: number | null,
  comparisonValue: number | null,
  direction: string | null
): {
  comparison_value_display: string;
  variance_display: string | null;
  comparison_state: MetricsExecutiveComparisonState;
} {
  if (
    scopeValue == null ||
    comparisonValue == null ||
    !Number.isFinite(scopeValue) ||
    !Number.isFinite(comparisonValue)
  ) {
    return {
      comparison_value_display: "—",
      variance_display: null,
      comparison_state: "neutral",
    };
  }

  const delta = scopeValue - comparisonValue;

  if (Math.abs(delta) < 0.000001) {
    return {
      comparison_value_display: format(comparisonValue),
      variance_display: "0.0",
      comparison_state: "neutral",
    };
  }

  const better =
    String(direction ?? "").toUpperCase() === "LOWER_BETTER"
      ? delta < 0
      : delta > 0;

  return {
    comparison_value_display: format(comparisonValue),
    variance_display: `${delta > 0 ? "+" : ""}${format(delta)}`,
    comparison_state: better ? "better" : "worse",
  };
}

export function buildExecutiveKpis(
  args: BuildExecutiveKpisArgs
): MetricsExecutiveKpiItem[] {
  if (!args.definitions?.length) return [];

  const scopeRowsAll = resolveScope(args);
  const comparisonRowsAll = resolveComparisonRows(args);

  return args.definitions.map((def) => {
    const scopeRows = scopeRowsAll.filter((r) => r.metric_key === def.kpi_key);
    const comparisonRows = comparisonRowsAll.filter(
      (r) => r.metric_key === def.kpi_key
    );

    const scopeValue = computeKpiValue(scopeRows, def.kpi_key);
    const comparisonValue = computeKpiValue(comparisonRows, def.kpi_key);

    const band = resolveBandFromRubric({
      rows: scopeRows,
      value: scopeValue,
      rubricRows: getRubricRows(args.rubricByKpi, def.kpi_key),
    });

    const comparison = resolveComparisonState(
      scopeValue,
      comparisonValue,
      def.direction
    );

    return {
      kpi_key: def.kpi_key,
      label: def.customer_label || def.label || def.kpi_key,
      value_display: format(scopeValue),
      band_key: band,
      band_label: bandLabel(band),
      support: args.support ?? null,
      comparison_scope_code: args.comparison_scope_code,
      comparison_value_display: comparison.comparison_value_display,
      variance_display: comparison.variance_display,
      comparison_state: comparison.comparison_state,
    };
  });
}