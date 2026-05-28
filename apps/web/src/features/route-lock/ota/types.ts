// path: apps/web/src/features/route-lock/ota/types.ts

export type OtaReportScope = "week" | "month";

export type OtaStatus = "ON_TIME" | "GRACE" | "LATE" | "INELIGIBLE" | "UNKNOWN";

export type OtaDetailRow = {
  shift_date: string;
  weekday_label: string;
  tech_id: string;
  full_name: string;
  affiliation: string | null;
  job_num: string | null;
  work_order_number: string | null;
  job_type: string | null;
  time_frame: string | null;
  time_frame_minutes: number | null;
  actual_start_time: string | null;
  ttfj_minutes: number | null;
  ttfj_display: string;
  late_minutes: number | null;
  late_display: string;
  status: OtaStatus;
  is_ttfj_eligible: boolean;
  exclusion_reason: string | null;
};

export type OtaDayGroup = {
  shift_date: string;
  weekday_label: string;
  first_jobs: number;
  eligible_count: number;
  late_count: number;
  on_time_or_grace: number;
  late_rate: number;
  avg_ttfj_minutes: number | null;
  avg_ttfj_display: string;
  worst_late_minutes: number;
  worst_late_display: string;
  status: "CLEAN" | "NEEDS_ATTENTION" | "NO_DATA";
  rows: OtaDetailRow[];
};

export type OtaWeek = {
  week_start: string;
  week_end: string;
  first_jobs: number;
  eligible_count: number;
  on_time_or_grace: number;
  late_count: number;
  late_rate: number;
  avg_ttfj_minutes: number | null;
  avg_ttfj_display: string;
  worst_late_minutes: number;
  worst_late_display: string;
  status: "CLEAN" | "NEEDS_ATTENTION" | "NO_DATA";
  day_groups: OtaDayGroup[];
};

export type OtaPayload = {
  ok: true;
  scope: OtaReportScope;
  anchor: string;
  window: {
    from: string;
    to: string;
    label: string;
    previous_anchor: string;
    next_anchor: string;
  };
  summary: {
    first_jobs: number;
    eligible_count: number;
    late_count: number;
    late_rate: number;
    avg_ttfj_minutes: number | null;
    avg_ttfj_display: string;
    worst_late_minutes: number;
    worst_late_display: string;
  };
  weeks: OtaWeek[];
};
