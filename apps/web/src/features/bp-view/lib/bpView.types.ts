import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";

export type BpRangeKey = "FM" | "3FM" | "12FM";

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

export type BpViewPayload = {
  header: BpViewHeaderData;
  kpi_strip: BpViewKpiItem[];
  risk_strip: BpViewRiskItem[];
  work_mix: BpWorkMix;
  roster_columns: Array<{ kpi_key: string; label: string }>;
  roster_rows: BpViewRosterRow[];
};