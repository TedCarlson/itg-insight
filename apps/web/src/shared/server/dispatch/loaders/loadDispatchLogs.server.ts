import { DISPATCH_LOG_SELECT_COLS } from "../constants/dispatchEventTypes";
import type { DispatchLogGetInput, DispatchLogSelectRow, SupabaseAdminClient } from "../types/dispatchLog.types";
import { dispatchBadRequest } from "../utils/dispatchErrors";

export async function loadDispatchLogs(
  admin: SupabaseAdminClient,
  input: DispatchLogGetInput,
): Promise<DispatchLogSelectRow[]> {
  let q = admin
    .from("dispatch_console_log")
    .select(DISPATCH_LOG_SELECT_COLS)
    .eq("pc_org_id", input.pc_org_id)
    .eq("shift_date", input.shift_date)
    .order("created_at", { ascending: false });

  if (input.event_type) q = q.eq("event_type", input.event_type);
  if (input.assignment_id) q = q.eq("assignment_id", input.assignment_id);

  const res = await q;

  if (res.error) {
    dispatchBadRequest("log_fetch_failed", res.error);
  }

  return (res.data ?? []) as unknown as DispatchLogSelectRow[];
}