import { DISPATCH_EVENT_TYPES } from "../constants/dispatchEventTypes";
import type {
  DispatchEventType,
  DispatchLogCreateInput,
  DispatchLogDeleteInput,
  DispatchLogGetInput,
  DispatchLogUpdateInput,
} from "../types/dispatchLog.types";
import { dispatchBadRequest } from "../utils/dispatchErrors";
import { clean, isISODate } from "../utils/dispatchLogUtils";
import { getMetaObject, stringOrNull } from "../utils/dispatchMeta";

function asEventType(value: unknown): DispatchEventType {
  const eventType = clean(value);

  if (!DISPATCH_EVENT_TYPES.includes(eventType as DispatchEventType)) {
    dispatchBadRequest("invalid_event_type");
  }

  return eventType as DispatchEventType;
}

export function parseDispatchLogGetQuery(params: URLSearchParams): DispatchLogGetInput {
  const pc_org_id = clean(params.get("pc_org_id"));
  const shift_date = clean(params.get("shift_date"));
  const event_type_raw = clean(params.get("event_type"));
  const assignment_id = clean(params.get("assignment_id"));

  if (!pc_org_id) dispatchBadRequest("missing_pc_org_id");
  if (!shift_date || !isISODate(shift_date)) dispatchBadRequest("invalid_shift_date");

  return {
    pc_org_id,
    shift_date,
    event_type: event_type_raw ? asEventType(event_type_raw) : undefined,
    assignment_id: assignment_id || undefined,
  };
}

export function parseDispatchLogCreateBody(body: unknown, created_by_user_id: string): DispatchLogCreateInput {
  if (!body || typeof body !== "object") dispatchBadRequest("invalid_json");

  const raw = body as Record<string, unknown>;

  const pc_org_id = clean(raw.pc_org_id);
  const shift_date = clean(raw.shift_date);
  const assignment_id = clean(raw.assignment_id);
  const event_type = asEventType(raw.event_type);
  const message = clean(raw.message);
  const tags = raw.tags ?? null;
  const meta = raw.meta ?? null;
  const dedupe_key = stringOrNull(raw.dedupe_key);
  const event_group_id = stringOrNull(raw.event_group_id);

  if (!pc_org_id) dispatchBadRequest("missing_pc_org_id");
  if (!shift_date || !isISODate(shift_date)) dispatchBadRequest("invalid_shift_date");
  if (!message) dispatchBadRequest("missing_message");

  const metaObj = getMetaObject(meta);
  const techMoveToRouteId = stringOrNull(metaObj.to_route_id);

  if (event_type === "TECH_MOVE" && !techMoveToRouteId) {
    dispatchBadRequest("missing_to_route_id");
  }

  if (event_type !== "NOTE" && !assignment_id) {
    dispatchBadRequest("missing_assignment_id");
  }

  return {
    pc_org_id,
    shift_date,
    assignment_id,
    event_type,
    message,
    tags,
    meta,
    dedupe_key,
    event_group_id,
    created_by_user_id,
  };
}

export function parseDispatchLogUpdateBody(body: unknown, updated_by_user_id: string): DispatchLogUpdateInput {
  if (!body || typeof body !== "object") dispatchBadRequest("invalid_json");

  const raw = body as Record<string, unknown>;

  const pc_org_id = clean(raw.pc_org_id);
  const dispatch_console_log_id = clean(raw.dispatch_console_log_id);
  const event_type = asEventType(raw.event_type);
  const message = clean(raw.message);

  if (!dispatch_console_log_id) dispatchBadRequest("missing_dispatch_console_log_id");
  if (!pc_org_id) dispatchBadRequest("missing_pc_org_id");
  if (!message) dispatchBadRequest("missing_message");

  return {
    pc_org_id,
    dispatch_console_log_id,
    event_type,
    message,
    updated_by_user_id,
  };
}

export function parseDispatchLogDeleteInput(args: {
  body: unknown;
  searchParams: URLSearchParams;
  auth_user_id: string;
}): DispatchLogDeleteInput {
  const raw = args.body && typeof args.body === "object" ? (args.body as Record<string, unknown>) : {};

  const pc_org_id = clean(raw.pc_org_id ?? args.searchParams.get("pc_org_id"));
  const dispatch_console_log_id = clean(
    raw.dispatch_console_log_id ?? args.searchParams.get("dispatch_console_log_id"),
  );

  if (!dispatch_console_log_id) dispatchBadRequest("missing_dispatch_console_log_id");
  if (!pc_org_id) dispatchBadRequest("missing_pc_org_id");

  return {
    pc_org_id,
    dispatch_console_log_id,
    auth_user_id: args.auth_user_id,
  };
}