// path: apps/web/src/features/route-lock/history/lib/history.types.ts

export type TechSearchItem = {
  assignment_id: string;
  person_id: string;
  tech_id: string;
  full_name: string;
  co_name: string | null;
  is_bp_affiliate?: boolean;
};

export type HistoryEvent = {
  effective_date: string;
  event_type: "INITIAL_ASSIGNMENT" | "ROUTE_CHANGE" | "BASELINE_DAYS_CHANGE" | string;
  from_value?: string | number | null;
  to_value?: string | number | null;
  from_day_set?: string | null;
  to_day_set?: string | null;
};

export type HistoryDetailRow = {
  shift_date: string;
  weekday_key: string;
  weekday_label: string;
  is_baseline_day: boolean;
  route_id: string | null;
  route_name: string | null;
};

export type HistorySegment = {
  segment_id: string;
  from_date: string;
  to_date: string;
  route_id: string | null;
  route_name: string | null;
  baseline_days_count: number;
  baseline_day_set: string[];
  baseline_day_set_label: string;
  span_days: number;
  detail_rows: HistoryDetailRow[];
};

export type HistoryResponse = {
  ok: true;
  tech: {
    assignment_id: string;
    tech_id: string;
    full_name: string;
    co_name: string | null;
  };
  window: {
    from: string;
    to: string;
  };
  events: HistoryEvent[];
  segments: HistorySegment[];
};

export type CheckInDailySummaryRow = {
  shift_date: string;
  weekday_label: string;

  is_scheduled: boolean;
  is_worked: boolean;

  actual_jobs: number;
  actual_units: number;
  actual_hours: number;
  units_per_hour: number;

  sla_bptrl_jobs: number;
  sla_bptrl_units: number;
  sla_bptrl_hours: number;

  between_job_minutes: number;
  avg_between_job_minutes: number | null;

  signal: "OFF" | "PRODUCTION" | "SLA" | "SCHEDULED_NO_PRODUCTION" | "OFF_SCHEDULE_WORK";
};

export type CheckInWeekJobRow = {
  shift_date: string;
  weekday_label: string;
  tech_id: string;

  job_num: string;
  work_order_number: string | null;

  job_type: string | null;
  job_units: number;

  start_time: string | null;
  cp_time: string | null;

  job_duration: number;

  is_sla_bptrl: boolean;
  source_tech_last_name: string | null;

  between_job_minutes: number | null;
  resolution_code: string | null;
};

export type CheckInWeeklyRow = {
  assignment_id: string;

  week_start: string;
  week_end: string;
  week_ending_saturday: string;
  calendar_year: number;
  calendar_week: number;

  tech_id: string;
  full_name: string;
  affiliation: string | null;

  days_worked: number;
  worked_dates: string[];
  worked_dates_label: string;

  worked_date_details: CheckInDailySummaryRow[];

  actual_jobs: number;
  actual_units: number;
  actual_hours: number;

  jobs_per_day: number;
  units_per_day: number;
  hours_per_day: number;
  units_per_hour: number;

  sla_bptrl_jobs: number;
  sla_bptrl_units: number;
  sla_bptrl_hours: number;

  sla_bptrl_jobs_per_day: number;
  sla_bptrl_units_per_day: number;
  sla_bptrl_hours_per_day: number;

  job_rows: CheckInWeekJobRow[];
};

export type CheckInWeeklyResponse = {
  ok: true;
  tech: {
    assignment_id: string;
    tech_id: string;
    full_name: string;
    affiliation: string | null;
  };
  window: {
    from: string;
    to: string;
  };
  rows: CheckInWeeklyRow[];
};

export type CheckInDayJobRow = {
  shift_date: string;
  tech_id: string;

  job_num: string;
  work_order_number: string | null;

  job_type: string | null;
  job_units: number;
  resolution_code: string | null;

  start_time: string | null;
  cp_time: string | null;

  job_duration: number;

  is_sla_bptrl: boolean;
  source_tech_last_name: string | null;

  between_job_minutes: number | null;
};

export type CheckInDayResponse = {
  ok: true;

  tech: {
    assignment_id: string;
    tech_id: string;
    full_name: string;
    affiliation: string | null;
  };

  shift_date: string;

  rows: CheckInDayJobRow[];
};