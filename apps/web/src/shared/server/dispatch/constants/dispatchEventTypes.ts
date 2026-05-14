import type { DispatchEventType } from "../types/dispatchLog.types";

export const DISPATCH_EVENT_TYPES: DispatchEventType[] = [
  "CALL_OUT",
  "ADD_IN",
  "BP_LOW",
  "INCIDENT",
  "NOTE",
  "TECH_MOVE",
];

export const DISPATCH_LOG_SELECT_COLS =
  "dispatch_console_log_id,pc_org_id,shift_date,assignment_id,person_id,tech_id,affiliation_id,event_type,capacity_delta_routes,message,tags,meta,created_at,created_by_user_id,dedupe_key,event_group_id,updated_at,updated_by_user_id";