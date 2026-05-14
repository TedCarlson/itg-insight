import { DISPATCH_LOG_SELECT_COLS } from "../constants/dispatchEventTypes";
import type { DispatchIdentity, DispatchLogCreateInput, DispatchLogSelectRow, SupabaseAdminClient } from "../types/dispatchLog.types";
import { resolveDispatchIdentity } from "../loaders/resolveDispatchIdentity.server";
import { applyDispatchAddIn } from "./applyDispatchAddIn.server";
import { createDispatchTechMoveQueue } from "./createDispatchTechMoveQueue.server";
import { dispatchBadRequest } from "../utils/dispatchErrors";
import { deltaForDispatchEventType } from "../utils/dispatchDelta";

async function insertDispatchLog(args: {
  admin: SupabaseAdminClient;
  input: DispatchLogCreateInput;
  identity: DispatchIdentity | null;
  capacity_delta_routes: number;
}): Promise<DispatchLogSelectRow> {
  const { admin, input, identity, capacity_delta_routes } = args;

  const res = await admin
    .from("dispatch_console_log")
    .insert({
      pc_org_id: input.pc_org_id,
      shift_date: input.shift_date,
      assignment_id: input.assignment_id || null,
      person_id: identity?.person_id ?? null,
      tech_id: identity?.tech_id ?? null,
      affiliation_id: identity?.affiliation_id ?? null,
      event_type: input.event_type,
      capacity_delta_routes,
      message: input.message,
      tags: input.tags,
      meta: input.meta,
      dedupe_key: input.dedupe_key,
      event_group_id: input.event_group_id,
      created_by_user_id: input.created_by_user_id,
    })
    .select(DISPATCH_LOG_SELECT_COLS)
    .single();

  if (res.error) {
    dispatchBadRequest("log_insert_failed", res.error);
  }

  return res.data as unknown as DispatchLogSelectRow;
}

export async function createDispatchLog(
  admin: SupabaseAdminClient,
  input: DispatchLogCreateInput,
): Promise<DispatchLogSelectRow> {
  if (input.event_type === "NOTE") {
    let identity: DispatchIdentity | null = null;

    if (input.assignment_id) {
      identity = await resolveDispatchIdentity({
        admin,
        pc_org_id: input.pc_org_id,
        shift_date: input.shift_date,
        assignment_id: input.assignment_id,
      });
    }

    return insertDispatchLog({
      admin,
      input,
      identity,
      capacity_delta_routes: 0,
    });
  }

  const identity = await resolveDispatchIdentity({
    admin,
    pc_org_id: input.pc_org_id,
    shift_date: input.shift_date,
    assignment_id: input.assignment_id,
  });

  const row = await insertDispatchLog({
    admin,
    input,
    identity,
    capacity_delta_routes: deltaForDispatchEventType(input.event_type),
  });

  if (input.event_type === "ADD_IN") {
    await applyDispatchAddIn({
      admin,
      pc_org_id: input.pc_org_id,
      shift_date: input.shift_date,
      tech_id: identity.tech_id,
      message: input.message,
      user_id: input.created_by_user_id,
    });
  }

  if (input.event_type === "TECH_MOVE") {
    await createDispatchTechMoveQueue({
      admin,
      dispatch_console_log_id: row.dispatch_console_log_id,
      pc_org_id: input.pc_org_id,
      shift_date: input.shift_date,
      assignment_id: input.assignment_id,
      person_id: identity.person_id,
      tech_id: identity.tech_id,
      requested_by_user_id: input.created_by_user_id,
      meta: input.meta,
    });
  }

  return row;
}