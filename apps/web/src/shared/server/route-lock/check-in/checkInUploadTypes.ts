// path: apps/web/src/shared/server/route-lock/check-in/checkInUploadTypes.ts

export type CheckInUploadOk = {
  ok: true;
  row_count_loaded: number;
  row_count_total: number;
  fulfillment_center_id: number;
  batch_id?: string | null;
  min_cp_date?: string | null;
  max_cp_date?: string | null;
  day_fact_rows?: number;
  today_ny?: string;
  filtered_out_today_or_future?: number;
};

export type CheckInUploadErr = {
  ok: false;
  error: string;
  hint?: string;
  expected?: unknown;
  received?: unknown;
  detail?: unknown;
};

export type ParsedCheckInRow = {
  tech_id: string;
  job_num: string;
  cp_date: string;

  source_tech_last_name: string | null;
  is_sla_bptrl: boolean;

  work_order_number: string | null;
  account: string | null;
  job_type: string | null;
  job_units: number | null;

  time_slot_start_time: string | null;
  time_slot_end_time: string | null;
  start_time: string | null;
  cp_time: string | null;

  job_duration_hours: number | null;

  resolution_code: string | null;
  job_comment: string | null;
};

export type ParsedCheckInWorkbook = {
  sheetName: string | null;
  fc: {
    id: number;
    name: string | null;
    label: string;
  } | null;
  rows: ParsedCheckInRow[];
  debug: Record<string, unknown>;
};

export type FiscalMonthRow = {
  fiscal_month_id: string;
  start_date: string;
  end_date: string;
  label?: string | null;
};

export type CheckInDayFactAgg = {
  pc_org_id: string;
  shift_date: string;
  tech_id: string;
  fiscal_month_id: string;
  fiscal_end_date: string;
  fulfillment_center_id: number;

  actual_jobs: number;
  actual_units: number;
  actual_hours: number;

  sla_bptrl_jobs: number;
  sla_bptrl_units: number;
  sla_bptrl_hours: number;

  first_start_time: string | null;
  last_cp_time: string | null;
};

export type CheckInUploadServiceInput = {
  admin: any;
  pcOrgId: string;
  uploadedByAuthUserId: string;
  file: File;
};