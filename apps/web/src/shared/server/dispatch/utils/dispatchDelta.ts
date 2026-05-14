import type { DispatchEventType } from "../types/dispatchLog.types";

export function deltaForDispatchEventType(eventType: DispatchEventType): number {
  if (eventType === "CALL_OUT") return -1;
  if (eventType === "ADD_IN") return 1;
  return 0;
}