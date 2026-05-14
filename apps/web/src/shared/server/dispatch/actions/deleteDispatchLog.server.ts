import { supabaseServer } from "@/shared/data/supabase/server";
import type { DispatchLogDeleteInput, SupabaseAdminClient } from "../types/dispatchLog.types";
import { dispatchBadRequest, dispatchForbidden, dispatchNotFound } from "../utils/dispatchErrors";

export async function deleteDispatchLog(admin: SupabaseAdminClient, input: DispatchLogDeleteInput) {
  const pre = await admin
    .from("dispatch_console_log")
    .select("dispatch_console_log_id,pc_org_id,created_by_user_id")
    .eq("dispatch_console_log_id", input.dispatch_console_log_id)
    .maybeSingle();

  if (pre.error) dispatchBadRequest("log_lookup_failed", pre.error);
  if (!pre.data) dispatchNotFound("log_not_found");
  if (String(pre.data.pc_org_id) !== String(input.pc_org_id)) dispatchBadRequest("pc_org_mismatch");
  if (String(pre.data.created_by_user_id) !== String(input.auth_user_id)) dispatchForbidden("delete_forbidden");

  const sb = await supabaseServer();

  const del = await sb.from("dispatch_console_log").delete().eq("dispatch_console_log_id", input.dispatch_console_log_id);

  if (del.error) dispatchBadRequest("delete_failed", del.error);
}