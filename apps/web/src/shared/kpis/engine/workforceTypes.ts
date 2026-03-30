import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";

export type WorkforceMetricCell = {
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

export type WorkforceWorkMix = {
  installs: number;
  tcs: number;
  sros: number;
  total: number;
};

export type WorkforceRow = {
  person_id: string;
  tech_id: string;
  full_name: string;
  context: string;
  office_name?: string | null;
  leader_assignment_id?: string | null;
  leader_person_id?: string | null;
  leader_name?: string | null;
  leader_title?: string | null;
  contractor_name?: string | null;
  rank: number | null;
  metrics: WorkforceMetricCell[];
  below_target_count: number;
  work_mix: WorkforceWorkMix;
};

export type WorkforceKpiConfig = {
  kpi_key: string;
  label: string;
};

export type WorkforceRubricRow = {
  kpi_key: string;
  band_key: BandKey;
  min_value: number | null;
  max_value: number | null;
};