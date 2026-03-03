// RUN THIS
// Create (or replace) the entire file:
// apps/web/src/features/dispatch-console/lib/labels.ts

import type { EntryType, LogRow, WorkforceRow } from "./types";

export const EVENT_ORDER: EntryType[] = ["CALL_OUT", "ADD_IN", "BP_LOW", "INCIDENT", "TECH_MOVE", "NOTE"];

export function fmtDelta(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

export function labelForEvent(t: LogRow["event_type"] | EntryType) {
  if (t === "CALL_OUT") return "Call Out";
  if (t === "ADD_IN") return "Add In";
  if (t === "BP_LOW") return "BP-Low";
  if (t === "INCIDENT") return "Incident";
  if (t === "TECH_MOVE") return "Tech Move";
  return "Note";
}

export function labelForEntryType(t: EntryType) {
  return labelForEvent(t);
}

export function routeLabel(r: { planned_route_name?: string | null; planned_route_id?: string | null }) {
  const name = (r.planned_route_name ?? "").trim();
  if (name) return name;

  const id = (r.planned_route_id ?? "").trim();
  if (id) return `Route ${id.slice(0, 8)}`;

  return "Unassigned";
}

export function buildAutoDraft(entryType: EntryType, tech: WorkforceRow) {
  const t = String(tech.tech_id ?? "").trim();
  const n = String(tech.full_name ?? "").trim();
  const r = routeLabel(tech);
  return `${labelForEntryType(entryType)} — ${t} • ${n} • ${r}`;
}

/**
 * Used when editing:
 * - If the message already has a known prefix ("Call Out — ..."), replace just the prefix.
 * - Otherwise, fall back to building a clean auto-draft for the new type + selected tech (if any).
 */
export function mutateDraftPrefix(args: { message: string; nextType: EntryType; tech?: WorkforceRow | null }) {
  const msg = (args.message ?? "").trim();
  const nextPrefix = `${labelForEntryType(args.nextType)} —`;

  // If it already looks like "<SomeLabel> — ..."
  const idx = msg.indexOf("—");
  if (idx > 0) {
    const before = msg.slice(0, idx).trim(); // label area (might include spacing)
    const after = msg.slice(idx + 1).trim(); // rest after —
    // only mutate if the "label area" matches any known label
    const known = ["Call Out", "Add In", "BP-Low", "Incident", "Tech Move", "Note"];
    const beforeClean = before.replace(/\s+$/, "");
    if (known.some((k) => beforeClean === k)) {
      return `${nextPrefix} ${after}`;
    }
  }

  if (args.tech) return buildAutoDraft(args.nextType, args.tech);
  return `${nextPrefix} ${msg}`.trim();
}

/**
 * Chip styling that DOES NOT fight theme tokens.
 * We only lightly tint background and keep readable ink via theme vars.
 *
 * - CALL_OUT: danger tint
 * - ADD_IN: success tint
 * - all others: neutral surface tint (NO "neutral" Badge variant usage)
 */
export function chipClassForEvent(t: EntryType | LogRow["event_type"]): React.CSSProperties {
  if (t === "CALL_OUT") {
    return { background: "var(--to-danger-surface, var(--to-surface-2))", color: "var(--to-ink)" };
  }
  if (t === "ADD_IN") {
    return { background: "var(--to-success-surface, var(--to-surface-2))", color: "var(--to-ink)" };
  }
  // Others: keep it subtle and readable
  return { background: "var(--to-surface-2)", color: "var(--to-ink)" };
}