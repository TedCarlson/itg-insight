// path: apps/web/src/shared/lib/metrics/buildScopedExecutiveStrip.ts

import { buildExecutiveKpis } from "@/shared/domain/metrics/buildExecutiveKpis";
import type {
  MetricsExecutiveRuntimeRubricRow,
  MetricsScopedExecutiveKpiItem,
} from "@/shared/types/metrics/executiveStrip";

type ScopedRowLike = {
  tech_id?: string | null;
};

type ExecutiveStripRuntimeLike = {
  current_rows: Array<{ tech_id: string }>;
  previous_rows: Array<{ tech_id: string }>;
  rubric_rows: MetricsExecutiveRuntimeRubricRow[];
  definitions: unknown;
  comparison_scope_code: string;
};

function buildRubricMap(rows: MetricsExecutiveRuntimeRubricRow[]) {
  const map = new Map<string, MetricsExecutiveRuntimeRubricRow[]>();

  for (const row of rows) {
    if (!map.has(row.kpi_key)) {
      map.set(row.kpi_key, []);
    }
    map.get(row.kpi_key)!.push(row);
  }

  return map as Map<string, any[]>;
}

export function buildScopedExecutiveStrip(args: {
  runtime?: ExecutiveStripRuntimeLike | null;
  scopedRows: ScopedRowLike[];
  fallbackItems?: MetricsScopedExecutiveKpiItem[] | null;
}): MetricsScopedExecutiveKpiItem[] {
  const { runtime, scopedRows, fallbackItems } = args;

  if (!runtime) return fallbackItems ?? [];

  const scopedTechIds = new Set(
    scopedRows
      .map((row) => String(row.tech_id ?? "").trim())
      .filter(Boolean)
  );

  const currentRows = runtime.current_rows.filter((row) =>
    scopedTechIds.has(row.tech_id)
  );

  const previousRows = runtime.previous_rows.filter((row) =>
    scopedTechIds.has(row.tech_id)
  );

  const rubricByKpi = buildRubricMap(runtime.rubric_rows);

  const scopedTrend = buildExecutiveKpis({
    definitions: runtime.definitions as any,
    supervisorScores: currentRows as any,
    orgScores: previousRows as any,
    rubricByKpi: rubricByKpi as any,
    support: null,
    comparison_scope_code: "SCOPE_TREND",
  });

  const scopedContrast = buildExecutiveKpis({
    definitions: runtime.definitions as any,
    supervisorScores: currentRows as any,
    orgScores: runtime.current_rows as any,
    rubricByKpi: rubricByKpi as any,
    support: null,
    comparison_scope_code: runtime.comparison_scope_code,
  });

  return scopedTrend.map((trendItem) => {
    const contrastItem = scopedContrast.find(
      (item) => item.kpi_key === trendItem.kpi_key
    );

    return {
      kpi_key: trendItem.kpi_key,
      label: trendItem.label,
      value_display: trendItem.value_display,
      band_key: trendItem.band_key,
      band_label: trendItem.band_label,
      support: trendItem.support ?? null,

      trend_scope_code: trendItem.comparison_scope_code,
      trend_comparison_value_display: trendItem.comparison_value_display,
      trend_variance_display: trendItem.variance_display,
      trend_state: trendItem.comparison_state,

      contrast_scope_code: runtime.comparison_scope_code,
      contrast_comparison_value_display:
        contrastItem?.comparison_value_display ?? "—",
      contrast_variance_display: contrastItem?.variance_display ?? null,
      contrast_state: contrastItem?.comparison_state ?? "neutral",
    };
  });
}