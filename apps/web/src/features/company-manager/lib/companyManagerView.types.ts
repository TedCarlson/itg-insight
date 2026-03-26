import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";
import type { RangeKey } from "@/features/bp-view/lib/bpViewResolverRegistry";

export type TeamClass = "ITG" | "BP";

export type CompanyManagerRosterMetricCell = {
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

export type CompanyManagerRosterWorkMix = {
  installs: number;
  tcs: number;
  sros: number;
  total: number;
};

export type CompanyManagerRosterRow = {
  person_id: string;
  tech_id: string;
  full_name: string;
  context: string;

  team_class: TeamClass;
  contractor_name: string | null;

  rank: number | null;
  metrics: CompanyManagerRosterMetricCell[];
  below_target_count: number;
  work_mix: CompanyManagerRosterWorkMix;
};

export type CompanyManagerRollupMetricSummary = {
  value: number | null;
  band: BandKey | null;
};

export type CompanyManagerMetricOrderItem = {
  kpi_key: string;
  label: string;
};

export type CompanyManagerOfficeRollupRow = {
  office: string;
  headcount: number;
  jobs: number;
  installs: number;
  tcs: number;
  sros: number;
  below_target_count: number;
  metrics: Map<string, CompanyManagerRollupMetricSummary>;
  metric_order: CompanyManagerMetricOrderItem[];
};

export type CompanyManagerLeadershipRollupRow = {
  leader_key: string;
  leader_name: string;
  leader_title: string | null;
  headcount: number;
  jobs: number;
  installs: number;
  tcs: number;
  sros: number;
  below_target_count: number;
  metrics: Map<string, CompanyManagerRollupMetricSummary>;
  metric_order: CompanyManagerMetricOrderItem[];
};

export type CompanyManagerWorkMix = {
  total: number;
  installs: number;
  tcs: number;
  sros: number;
  install_pct: number | null;
  tc_pct: number | null;
  sro_pct: number | null;
};

export type CompanyManagerHeaderData = {
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

export type CompanyManagerPayload = {
  header: CompanyManagerHeaderData;

  kpi_strip: any[];
  risk_strip: any[];

  work_mix: CompanyManagerWorkMix;

  roster_columns: Array<{
    kpi_key: string;
    label: string;
  }>;

  roster_rows: CompanyManagerRosterRow[];
  office_rollups: {
    ALL: CompanyManagerOfficeRollupRow[];
    ITG: CompanyManagerOfficeRollupRow[];
    BP: CompanyManagerOfficeRollupRow[];
    BP_BY_CONTRACTOR: Record<string, CompanyManagerOfficeRollupRow[]>;
  };
  leadership_rollups: {
    ALL: CompanyManagerLeadershipRollupRow[];
    ITG: CompanyManagerLeadershipRollupRow[];
    BP: CompanyManagerLeadershipRollupRow[];
    BP_BY_CONTRACTOR: Record<string, CompanyManagerLeadershipRollupRow[]>;
  };
};
