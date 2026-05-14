import type { supabaseAdmin } from "@/shared/data/supabase/admin";

export type DispatchEventType = "CALL_OUT" | "ADD_IN" | "BP_LOW" | "INCIDENT" | "NOTE" | "TECH_MOVE";

export type DispatchLogSelectRow = {
  dispatch_console_log_id: string;
  pc_org_id: string;
  shift_date: string;
  assignment_id: string | null;
  person_id: string | null;
  tech_id: string | null;
  affiliation_id: string | null;
  event_type: DispatchEventType;
  capacity_delta_routes: number;
  message: string;
  tags: unknown;
  meta: Record<string, unknown> | null;
  created_at: string;
  created_by_user_id: string;
  dedupe_key: string | null;
  event_group_id: string | null;
  updated_at: string | null;
  updated_by_user_id: string | null;
};

export type DispatchLogResponseRow = DispatchLogSelectRow & {
  created_by_name: string | null;
};

export type DispatchIdentity = {
  person_id: string;
  tech_id: string;
  affiliation_id: string | null;
};

export type SupabaseAdminClient = ReturnType<typeof supabaseAdmin>;

export type DispatchLogGetInput = {
  pc_org_id: string;
  shift_date: string;
  event_type?: DispatchEventType;
  assignment_id?: string;
};

export type DispatchLogCreateInput = {
  pc_org_id: string;
  shift_date: string;
  assignment_id: string;
  event_type: DispatchEventType;
  message: string;
  tags: unknown;
  meta: unknown;
  dedupe_key: string | null;
  event_group_id: string | null;
  created_by_user_id: string;
};

export type DispatchLogUpdateInput = {
  pc_org_id: string;
  dispatch_console_log_id: string;
  event_type: DispatchEventType;
  message: string;
  updated_by_user_id: string;
};

export type DispatchLogDeleteInput = {
  pc_org_id: string;
  dispatch_console_log_id: string;
  auth_user_id: string;
};