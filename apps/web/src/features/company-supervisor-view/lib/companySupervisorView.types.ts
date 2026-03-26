import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";
import type { RangeKey } from "@/features/bp-view/lib/bpViewResolverRegistry";

export type TeamClass = "ITG" | "BP";

export type CompanySupervisorRosterMetricCell = {
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

export type CompanySupervisorRosterWorkMix = {
  installs: number;
  tcs: number;
  sros: number;
  total: number;
};

export type CompanySupervisorRosterRow = {
  person_id: string;
  tech_id: string;
  full_name: string;
  context: string;

  team_class: TeamClass;
  contractor_name: string | null;

  rank: number | null;
  metrics: CompanySupervisorRosterMetricCell[];
  below_target_count: number;
  work_mix: CompanySupervisorRosterWorkMix;
};

export type CompanySupervisorWorkMix = {
  total: number;
  installs: number;
  tcs: number;
  sros: number;
  install_pct: number | null;
  tc_pct: number | null;
  sro_pct: number | null;
};

export type CompanySupervisorParityRow = {
  label: string;
  metrics: CompanySupervisorRosterMetricCell[];
  hc: number;
};

export type CompanySupervisorHeaderData = {
  role_label: string;
  scope_label: string;
  org_label: string;
  org_count: number;
  contractor_name: string | null;
  rep_full_name: string | null;
  headcount: number;
  range_label: RangeKey;
  as_of_date: string;
};

export type CompanySupervisorPayload = {
  header: CompanySupervisorHeaderData;

  kpi_strip: any[];
  risk_strip: any[];

  work_mix: CompanySupervisorWorkMix;

  roster_columns: Array<{
    kpi_key: string;
    label: string;
  }>;

  roster_rows: CompanySupervisorRosterRow[];
  parityRows: CompanySupervisorParityRow[];
};