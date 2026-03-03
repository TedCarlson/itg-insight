// RUN THIS
// Create (or replace) the entire file:
// apps/web/src/features/dispatch-console/lib/types.ts

export type EventType = "ALL" | "CALL_OUT" | "ADD_IN" | "BP_LOW" | "INCIDENT" | "NOTE" | "TECH_MOVE";
export type EntryType = Exclude<EventType, "ALL">;

export type WorkforceTab = "SCHEDULED" | "NOT_SCHEDULED";

export type WorkforceRow = {
  pc_org_id: string;
  shift_date: string;

  assignment_id: string;
  person_id: string;
  tech_id: string;
  affiliation_id: string | null;

  full_name: string;
  co_name: string | null;

  planned_route_id: string | null;
  planned_route_name: string | null;

  planned_start_time: string | null;
  planned_end_time: string | null;

  planned_hours: number | null;
  planned_units: number | null;

  sv_built: boolean | null;
  sv_route_id: string | null;
  sv_route_name: string | null;

  checked_in_at: string | null;

  schedule_as_of: string | null;
  sv_as_of: string | null;
  check_in_as_of: string | null;
};

export type DaySummary = {
  pc_org_id: string;
  shift_date: string;

  tech_count: number;
  built_count: number;
  checked_in_count: number;

  call_out_count: number;
  add_in_count: number;
  bp_low_count?: number;
  incident_count: number;
  note_count: number;

  net_capacity_delta_routes: number;

  quota_hours: number;
  quota_units: number;
  quota_routes_required: number;
  quota_as_of: string | null;
};

export type LogRow = {
  dispatch_console_log_id: string;
  pc_org_id: string;
  shift_date: string;

  // NOTE entries may be org-level (no assignment)
  assignment_id: string | null;
  person_id: string | null;
  tech_id: string | null;
  affiliation_id: string | null;

  event_type: EntryType;
  capacity_delta_routes: number;
  message: string;
  created_at: string;
  created_by_user_id: string;

  created_by_name?: string | null;
};