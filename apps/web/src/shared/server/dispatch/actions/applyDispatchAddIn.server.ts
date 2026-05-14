import type { SupabaseAdminClient } from "../types/dispatchLog.types";
import { dispatchBadRequest } from "../utils/dispatchErrors";

export async function applyDispatchAddIn(args: {
  admin: SupabaseAdminClient;
  pc_org_id: string;
  shift_date: string;
  tech_id: string;
  message: string;
  user_id: string;
}) {
  const existing = await args.admin
    .from("schedule_exception_day")
    .select("schedule_exception_day_id, exception_type, status")
    .eq("pc_org_id", args.pc_org_id)
    .eq("shift_date", args.shift_date)
    .eq("tech_id", args.tech_id)
    .maybeSingle();

  if (existing.error) {
    dispatchBadRequest("exception_lookup_failed", existing.error);
  }

  if (existing.data) {
    const upd = await args.admin
      .from("schedule_exception_day")
      .update({
        exception_type: "ADD_IN",
        approved: true,
        status: "APPROVED",
        force_off: false,
        notes: args.message,
        requested_by: args.user_id,
        approved_by: args.user_id,
        decision_notes: "Overridden by Dispatch ADD_IN",
        decision_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("schedule_exception_day_id", existing.data.schedule_exception_day_id);

    if (upd.error) {
      dispatchBadRequest("exception_update_failed", upd.error);
    }

    return;
  }

  const ins = await args.admin.from("schedule_exception_day").insert({
    pc_org_id: args.pc_org_id,
    shift_date: args.shift_date,
    tech_id: args.tech_id,
    exception_type: "ADD_IN",
    approved: true,
    force_off: false,
    notes: args.message,
    requested_by: args.user_id,
    approved_by: args.user_id,
    status: "APPROVED",
    decision_notes: "Created by Dispatch ADD_IN",
    decision_at: new Date().toISOString(),
  });

  if (ins.error) {
    dispatchBadRequest("exception_insert_failed", ins.error);
  }
}