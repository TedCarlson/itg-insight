export type MetricsExecutiveComparisonState =
  | "better"
  | "worse"
  | "neutral";

export type MetricsExecutiveKpiItem = {
  kpi_key: string;
  label: string;
  value_display: string;
  band_key: string;
  band_label: string;
  support?: string | null;
  comparison_scope_code: string;
  comparison_value_display: string;
  variance_display: string | null;
  comparison_state: MetricsExecutiveComparisonState;
};

export type MetricsSurfaceBasePayload = {
  items: MetricsExecutiveKpiItem[];
  title?: string | null;
  subtitle?: string | null;
};

export type MetricsScopedExecutiveKpiItem = {
  kpi_key: string;
  label: string;

  value_display: string;
  band_key: string;
  band_label: string;
  support?: string | null;

  trend_scope_code: string;
  trend_comparison_value_display: string;
  trend_variance_display: string | null;
  trend_state: MetricsExecutiveComparisonState;

  contrast_scope_code: string;
  contrast_comparison_value_display: string;
  contrast_variance_display: string | null;
  contrast_state: MetricsExecutiveComparisonState;
};

export type MetricsSurfaceScopePayload = {
  items: MetricsScopedExecutiveKpiItem[];
  title?: string | null;
  subtitle?: string | null;
};

export type MetricsExecutiveRuntimeDefinition = {
  kpi_key: string;
  label: string;
  customer_label?: string | null;
  direction?: string | null;
};

export type MetricsExecutiveRuntimeRubricRow = {
  kpi_key: string;
  band_key: string;
  min_value: number | null;
  max_value: number | null;
};

export type MetricsExecutiveRuntimeScoreRow = {
  tech_id: string;
  metric_key: string;
  metric_value: number | null;
  band_key?: string | null;
  weighted_points?: number | null;
  numerator?: number | null;
  denominator?: number | null;
};

export type MetricsExecutiveStripRuntimePayload = {
  definitions: MetricsExecutiveRuntimeDefinition[];
  rubric_rows: MetricsExecutiveRuntimeRubricRow[];
  current_rows: MetricsExecutiveRuntimeScoreRow[];
  previous_rows: MetricsExecutiveRuntimeScoreRow[];
  comparison_scope_code: string;
};