// path: apps/web/src/shared/types/metrics/surfacePayload.ts

import type { MetricsExecutiveKpiItem } from "@/shared/types/metrics/executiveStrip";

export type MetricsRangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

export type MetricsSurfacePermissions = {
  can_view_exec_strip: boolean;
  can_view_risk_strip: boolean;
  can_view_team_table: boolean;
  can_view_work_mix: boolean;
  can_view_parity: boolean;
  can_view_kpi_rubric: boolean;
  can_view_tech_drill: boolean;
  can_view_org_drill: boolean;
  can_filter_range: boolean;
  can_filter_scope: boolean;
  can_sort_table: boolean;
};

export type MetricsSurfaceHeader = {
  role_label: string | null;
  rep_full_name: string | null;
  org_display: string | null;
  pc_label: string | null;
  scope_headcount: number;
  total_headcount: number;
  as_of_date: string | null;
};

export type MetricsSurfaceFilters = {
  active_range: MetricsRangeKey;
  available_ranges: MetricsRangeKey[];
};

export type MetricsSurfaceVisibility = {
  show_jobs: boolean;
  show_risk: boolean;
  show_work_mix: boolean;
  show_parity: boolean;
};

export type MetricsSurfaceTeamColumn = {
  kpi_key: string;
  label: string;
  report_order: number | null;
};

export type MetricsSurfaceTeamCell = {
  metric_key: string;
  value: number | null;
  band_key: string;
  weighted_points: number | null;
  numerator?: number | null;
  denominator?: number | null;
};

export type MetricsRowWorkMix = {
  total: number;
  installs: number;
  tcs: number;
  sros: number;
};

export type MetricsSurfaceTeamRow = {
  tech_id: string | null;
  full_name: string | null;
  rank: number | null;
  composite_score: number | null;
  metrics: MetricsSurfaceTeamCell[];
  row_key?: string;
  work_mix: MetricsRowWorkMix | null;
  jobs_display: string | null;
  risk_count?: number | null;
  office_label?: string | null;
  affiliation_type?: string | null;
  reports_to_person_id?: string | null;
  co_code?: string | null;
};

export type MetricsSurfaceTeamTable = {
  columns: MetricsSurfaceTeamColumn[];
  rows: MetricsSurfaceTeamRow[];
};

export type MetricsRiskStripItem = {
  key: string;
  title: string;
  value: string;
  note: string;
};

export type MetricsRiskTrendDirection = "up" | "down" | "flat" | null;
export type MetricsRiskMovementType = "new" | "persistent" | "recovered";

export type MetricsRiskInsightTopPriority = {
  kpi_key: string | null;
  label: string | null;
  miss_count: number;
  tech_ids: string[];
  new_tech_ids: string[];
  persistent_tech_ids: string[];
  recovered_tech_ids: string[];
};

export type MetricsRiskInsightKpiMovement = {
  kpi_key: string;
  label: string;
  miss_count: number;
  tech_ids: string[];
  new_tech_ids: string[];
  persistent_tech_ids: string[];
  recovered_tech_ids: string[];
};

export type MetricsTopPriorityOverlayRow = {
  tech_id: string;
  full_name: string | null;
  rank: number | null;
  metric_value: number | null;
  band_key: string | null;
  trend_direction: MetricsRiskTrendDirection;
};

export type MetricsTopPriorityOverlay = {
  new_rows: MetricsTopPriorityOverlayRow[];
  persistent_rows: MetricsTopPriorityOverlayRow[];
  recovered_rows: MetricsTopPriorityOverlayRow[];
};

export type MetricsPriorityKpiOverlay = {
  kpi_key: string;
  label: string;
  new_rows: MetricsTopPriorityOverlayRow[];
  persistent_rows: MetricsTopPriorityOverlayRow[];
  recovered_rows: MetricsTopPriorityOverlayRow[];
};

export type MetricsParticipationOverlayMetric = {
  kpi_key: string;
  label: string;
  value: number | null;
  band_key: string | null;
};

export type MetricsParticipationOverlayRow = {
  tech_id: string;
  full_name: string | null;
  rank: number | null;
  metrics: MetricsParticipationOverlayMetric[];
};

export type MetricsParticipationOverlay = {
  meets_3_rows: MetricsParticipationOverlayRow[];
  meets_2_rows: MetricsParticipationOverlayRow[];
  meets_1_rows: MetricsParticipationOverlayRow[];
  meets_0_rows: MetricsParticipationOverlayRow[];
};

export type MetricsRiskInsightParticipationBucket = {
  count: number;
  tech_ids: string[];
};

export type MetricsRiskInsightParticipation = {
  meets_3: MetricsRiskInsightParticipationBucket;
  meets_2: MetricsRiskInsightParticipationBucket;
  meets_1: MetricsRiskInsightParticipationBucket;
  meets_0: MetricsRiskInsightParticipationBucket;
};

export type MetricsParticipationSignalKpi = {
  kpi_key: string;
  label: string;
  score: number;
  band_key: string;
  trend_delta: number | null;
  trend_direction: MetricsRiskTrendDirection;
  participating_count: number;
  eligible_count: number;
};

export type MetricsParticipationSignal = {
  by_kpi: MetricsParticipationSignalKpi[];
  overall_score: number;
  overall_band_key: string;
  trend_delta: number | null;
  trend_direction: MetricsRiskTrendDirection;
  eligible_count: number;
};

export type MetricsRiskInsightPerformer = {
  tech_id: string;
  full_name: string | null;
  rank: number | null;
  composite_score: number | null;
  risk_count: number;
  streak_count?: number | null;
  primary_kpi_key?: string | null;
  primary_kpi_label?: string | null;
};

export type MetricsRiskInsights = {
  top_priority_kpi: MetricsRiskInsightTopPriority;
  priority_kpis?: MetricsRiskInsightKpiMovement[];
  top_priority_kpi_overlay?: MetricsTopPriorityOverlay | null;
  priority_kpi_overlays?: MetricsPriorityKpiOverlay[] | null;
  participation_overlay?: MetricsParticipationOverlay | null;
  participation: MetricsRiskInsightParticipation;
  participation_signal?: MetricsParticipationSignal | null;
  top_performers: MetricsRiskInsightPerformer[];
  bottom_performers: MetricsRiskInsightPerformer[];
};

export type MetricsWorkMixSummary = {
  total: number;
  installs: number;
  tcs: number;
  sros: number;
  install_pct: number | null;
  tc_pct: number | null;
  sro_pct: number | null;
};

export type MetricsParityMetric = {
  kpi_key: string;
  label: string;
  value_display: string | null;
  band_key: string | null;
  rank_display?: string | null;
};

export type MetricsParityRow = {
  group_type: string;
  label: string;
  hc: number;
  rank_display?: string | null;
  metrics: MetricsParityMetric[];
};

export type MetricsJobsSummary = {
  total_jobs: number;
  installs: number;
  tcs: number;
  sros: number;
} | null;

export type MetricsJobsDetailRow = {
  label: string;
  value: number;
};

export type MetricsSurfaceOverlays = {
  work_mix: MetricsWorkMixSummary | null;
  parity_summary: MetricsParityRow[];
  parity_detail: MetricsParityRow[];
  jobs_summary: MetricsJobsSummary;
  jobs_detail: MetricsJobsDetailRow[];
};

export type MetricsSurfacePayload = {
  header: MetricsSurfaceHeader;
  permissions: MetricsSurfacePermissions;
  filters: MetricsSurfaceFilters;
  visibility: MetricsSurfaceVisibility;
  executive_kpis: MetricsExecutiveKpiItem[];
  risk_strip: MetricsRiskStripItem[];
  risk_insights?: MetricsRiskInsights | null;
  team_table: MetricsSurfaceTeamTable;
  overlays: MetricsSurfaceOverlays;
};

export type MetricsRangeResolvedBatch = {
  metric_batch_id: string;
  metric_date: string;
  fiscal_end_date: string | null;
};

export type MetricsRangeResolution = {
  active_range: MetricsRangeKey;
  batch_ids: string[];
  batches: MetricsRangeResolvedBatch[];
  as_of_date: string | null;
};