import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";

export type BpRangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

export type BpViewHeaderData = {
  role_label: string;
  scope_label: string;
  org_label: string;
  org_count: number;
  contractor_name: string | null;
  rep_full_name: string | null;
  headcount: number;
  range_label: BpRangeKey;
  as_of_date: string;
};

export type BpViewKpiItem = {
  kpi_key: string;
  label: string;
  value: number | null;
  value_display: string | null;
  band_key: BandKey;
  band_label: string;
  support: string | null;
};

export type BpViewRosterMetricCell = {
  kpi_key: string;
  label: string;

  value: number | null;
  value_display: string | null;
  band_key: BandKey;

  delta_value: number | null;
  delta_display: string | null;

  rank_value: number | null;
  rank_display: string | null;

  rank_delta_value: number | null;
  rank_delta_display: string | null;

  score_value: number | null;
  score_weight: number | null;
  score_contribution: number | null;
};

export type BpViewRosterWorkMix = {
  installs: number;
  tcs: number;
  sros: number;
  total: number;
};

export type BpViewRosterRow = {
  person_id: string;
  tech_id: string;
  full_name: string;
  context: string;
  contractor_name?: string | null;
  rank: number | null;
  metrics: BpViewRosterMetricCell[];
  below_target_count: number;
  work_mix: BpViewRosterWorkMix;
};

export type BpViewRiskItem = {
  title: string;
  value: string;
  note: string;
};

export type BpWorkMix = {
  total: number;
  installs: number;
  tcs: number;
  sros: number;
  install_pct: number | null;
  tc_pct: number | null;
  sro_pct: number | null;
};

export type BpRollupScopeType =
  | "bp_supervisor"
  | "office"
  | "leadership"
  | "contractor"
  | "segment";

export type BpRollupScope = {
  scope_type: BpRollupScopeType;
  scope_key: string;
  label: string;
  subtitle?: string | null;
  range_label: BpRangeKey;
};

export type BpRollupTrendPoint = {
  label: string;
  value: number | null;
  is_final?: boolean;
};

export type BpRollupFactRow = {
  label: string;
  value: string;
};

export type BpRollupTnpsSentimentMix = {
  surveys: number;
  promoters: number;
  passives: number;
  detractors: number;
};

export type BpRollupTnpsPeriodRow = {
  metric_date: string;
  fiscal_month_label?: string | null;
  is_month_final?: boolean;
  tnps_value: number | null;
  tnps_display: string | null;
  surveys: number;
  promoters: number;
  passives: number;
  detractors: number;
};

export type BpRollupTnpsContributorRow = {
  tech_id: string;
  full_name: string;
  contractor_name: string | null;
  surveys: number;
  promoters: number;
  passives: number;
  detractors: number;
  tnps_value: number | null;
  tnps_display: string | null;
  work_total?: number | null;
};

export type BpRollupKpiDetail = {
  kpi_key: string;
  label: string;
  value: number | null;
  value_display: string | null;
  band_key: BandKey;
  band_label: string;

  numerator?: number | null;
  denominator?: number | null;
  numerator_label?: string | null;
  denominator_label?: string | null;

  prior_value?: number | null;
  prior_value_display?: string | null;
  delta_value?: number | null;
  delta_display?: string | null;

  trend?: BpRollupTrendPoint[];
  fact_rows?: BpRollupFactRow[];

  sentiment_mix?: BpRollupTnpsSentimentMix | null;
  period_detail?: BpRollupTnpsPeriodRow[];
  tnps_contributors?: BpRollupTnpsContributorRow[];

  scope_context_rates?: Array<{
    label: string;
    value: number | null;
    value_display: string | null;
  }>;
};

export type BpRollupContributorRow = {
  tech_id: string;
  full_name: string;
  contractor_name?: string | null;
  work_total: number;
  metric_value: number | null;
  metric_value_display: string | null;
};

export type BpRollupDrillPayload = {
  scope: BpRollupScope;
  headcount: number;
  work_mix: BpWorkMix;
  selected_kpi: BpRollupKpiDetail | null;
  contributors: BpRollupContributorRow[];
};

export type BpRollupTnpsSummary = {
  surveys: number;
  promoters: number;
  passives: number;
  detractors: number;
  tnps_value: number | null;
  tnps_display: string | null;
};

export type BpRollupTnpsData = {
  summary: BpRollupTnpsSummary;
  contributors: BpRollupTnpsContributorRow[];
  all_checkpoints: BpRollupTnpsPeriodRow[];
  monthly_finals: BpRollupTnpsPeriodRow[];
};

export type BpViewPayload = {
  header: BpViewHeaderData;
  kpi_strip: BpViewKpiItem[];
  risk_strip: BpViewRiskItem[];
  work_mix: BpWorkMix;
  roster_columns: Array<{ kpi_key: string; label: string }>;
  roster_rows: BpViewRosterRow[];
  rollup_tnps?: BpRollupTnpsData | null;
};