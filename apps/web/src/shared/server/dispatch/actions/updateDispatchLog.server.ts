import { supabaseServer } from "@/shared/data/supabase/server";
import { DISPATCH_LOG_SELECT_COLS } from "../constants/dispatchEventTypes";
import type { DispatchLogSelectRow, DispatchLogUpdateInput, SupabaseAdminClient } from "../types/dispatchLog.types";
import { dispatchBadRequest, dispatchForbidden, dispatchNotFound } from "../utils/dispatchErrors";

export async function updateDispatchLog(
  admin: SupabaseAdminClient,
  input: DispatchLogUpdateInput,
): Promise<DispatchLogSelectRow> {
  const pre = await admin
    .from("dispatch_console_log")
    .select("dispatch_console_log_id,pc_org_id,created_by_user_id")
    .eq("dispatch_console_log_id", input.dispatch_console_log_id)
    .maybeSingle();

  if (pre.error) dispatchBadRequest("log_lookup_failed", pre.error);
  if (!pre.data) dispatchNotFound("log_not_found");
  if (String(pre.data.pc_org_id) !== String(input.pc_org_id)) dispatchBadRequest("pc_org_mismatch");
  if (String(pre.data.created_by_user_id) !== String(input.updated_by_user_id)) dispatchForbidden("edit_forbidden");

  const sb = await supabaseServer();

  const upd = await sb
    .from("dispatch_console_log")
    .update({
      event_type: input.event_type,
      message: input.message,
      updated_by_user_id: input.updated_by_user_id,
      updated_at: new Date().toISOString(),
    })
    .eq("dispatch_console_log_id", input.dispatch_console_log_id)
    .select(DISPATCH_LOG_SELECT_COLS)
    .single();

  if (upd.error) dispatchBadRequest("log_update_failed", upd.error);

  return upd.data as unknown as DispatchLogSelectRow;
}