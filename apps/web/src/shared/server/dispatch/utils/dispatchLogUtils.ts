import type { DispatchEventType } from "../types/dispatchLog.types";

export function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

