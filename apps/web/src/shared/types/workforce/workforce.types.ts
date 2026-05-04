// path: apps/web/src/shared/types/workforce/workforce.types.ts

export type WorkforceSeatType =
  | "FIELD"
  | "LEADERSHIP"
  | "SUPPORT"
  | "TRAVEL"
  | "DROP_BURY"
  | "FMLA";

export type WorkforceTabKey = WorkforceSeatType | "ALL" | "INCOMPLETE" | "PROCESSING";

export type WorkforceScheduleDay = {
  day: "U" | "M" | "T" | "W" | "H" | "F" | "S";
  state: "WORKING" | "OFF" | "UNKNOWN";
};

export type WorkforceRow = {
  assignment_id: string;
  person_id: string;
  workspace_id: string | null;
  pc_org_id: string | null;

  tech_id: string | null;

  full_name: string | null;
  legal_name: string | null;
  first_name: string | null;
  preferred_name: string | null;
  last_name: string | null;
  display_name: string;

  office_id: string | null;
  office: string | null;

  reports_to_assignment_id: string | null;
  reports_to_person_id: string | null;
  reports_to_name: string | null;

  schedule: WorkforceScheduleDay[];

  seat_type: WorkforceSeatType;

  mobile: string | null;
  email: string | null;
  nt_login: string | null;
  csg: string | null;

  position_title: string | null;
  affiliation_id: string | null;
  affiliation: string | null;

  start_date: string | null;
  end_date: string | null;

  assignment_status: string | null;
  person_status: string | null;
  is_primary: boolean;

  is_active: boolean;
  is_travel_tech: boolean;
  is_incomplete: boolean;

  searchable_text: string;
};