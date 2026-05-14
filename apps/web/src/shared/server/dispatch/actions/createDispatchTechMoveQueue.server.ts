import type { SupabaseAdminClient } from "../types/dispatchLog.types";
import { dispatchBadRequest } from "../utils/dispatchErrors";
import { getMetaObject, stringOrNull } from "../utils/dispatchMeta";

export async function createDispatchTechMoveQueue(args: {
  admin: SupabaseAdminClient;
  dispatch_console_log_id: string;
  pc_org_id: string;
  shift_date: string;
  assignment_id: string;
  person_id: string;
  tech_id: string;
  requested_by_user_id: string;
  meta: unknown;
}) {
  const metaObj = getMetaObject(args.meta);

  const res = await args.admin.from("dispatch_schedule_action_queue").insert({
    dispatch_console_log_id: args.dispatch_console_log_id,

    pc_org_id: args.pc_org_id,
    shift_date: args.shift_date,

    assignment_id: args.assignment_id,
    person_id: args.person_id,
    tech_id: args.tech_id,

    action_type: "TECH_MOVE_BASELINE_UPDATE",
    status: "PENDING",

    from_route_id: stringOrNull(metaObj.from_route_id),
    from_route_name: stringOrNull(metaObj.from_route_name),
    to_route_id: stringOrNull(metaObj.to_route_id),
    to_route_name: stringOrNull(metaObj.to_route_name),

    requested_by_user_id: args.requested_by_user_id,

    meta: {
      source: "dispatch_console",
    },
  });

  if (res.error) {
    dispatchBadRequest("schedule_action_queue_insert_failed", res.error);
  }
}