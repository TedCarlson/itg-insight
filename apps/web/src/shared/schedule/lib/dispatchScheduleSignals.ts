import type { ScheduleSurfaceRow } from "../types/scheduleSurfaceTypes";

export type DispatchScheduleSignal =
  | "CALL_OUT"
  | "INCIDENT"
  | "BP_LOW"
  | "TECH_MOVE"
  | "NOTE"
  | "ADD_IN";

export const DISPATCH_SCHEDULE_SIGNAL_ORDER: DispatchScheduleSignal[] = [
  "CALL_OUT",
  "INCIDENT",
  "BP_LOW",
  "TECH_MOVE",
  "NOTE",
  "ADD_IN",
];

export function dispatchSignalWeight(signal: DispatchScheduleSignal | string | null | undefined) {
  const index = DISPATCH_SCHEDULE_SIGNAL_ORDER.indexOf(signal as DispatchScheduleSignal);
  return index === -1 ? 10 : index;
}


export function sortDispatchSignals<T extends string>(signals: T[]) {
  return signals
    .slice()
    .sort((a, b) => {
      const weight = dispatchSignalWeight(a) - dispatchSignalWeight(b);
      if (weight !== 0) return weight;
      return String(a).localeCompare(String(b));
    });
}

export function dispatchSignalToneClass(signals: Array<string | null | undefined>) {
  const strongest = sortDispatchSignals(
    signals
      .map((signal) => String(signal ?? "").trim())
      .filter(Boolean),
  )[0];

  if (strongest === "CALL_OUT") return "border-red-300 bg-red-50/40 text-red-950";
  if (strongest === "INCIDENT") return "border-orange-300 bg-orange-50/40 text-orange-950";
  if (strongest === "BP_LOW") return "border-amber-300 bg-amber-50/40 text-amber-950";
  if (strongest === "TECH_MOVE") return "border-sky-300 bg-sky-50/40 text-sky-950";
  if (strongest === "NOTE") return "border-zinc-300 bg-zinc-50/40 text-zinc-950";
  if (strongest === "ADD_IN") return "border-emerald-300 bg-emerald-50/40 text-emerald-950";

  return "border-[var(--to-border)]";
}

export function dispatchSortWeight(row: ScheduleSurfaceRow) {
  if (row.dispatch.callOut) return dispatchSignalWeight("CALL_OUT");
  if (row.dispatch.incidentCount > 0) return dispatchSignalWeight("INCIDENT");
  if (row.dispatch.bpLow) return dispatchSignalWeight("BP_LOW");
  if (row.dispatch.techMove) return dispatchSignalWeight("TECH_MOVE");
  if (row.dispatch.noteCount > 0 || row.dispatch.latestNote) return dispatchSignalWeight("NOTE");
  if (row.dispatch.addIn) return dispatchSignalWeight("ADD_IN");
  return 10;
}

export function sortRowsForDispatchFocus(rows: ScheduleSurfaceRow[]) {
  return rows.slice().sort((a, b) => {
    const weight = dispatchSortWeight(a) - dispatchSortWeight(b);

    if (weight !== 0) return weight;

    const affiliate = String(a.affiliationCode ?? a.contractorName ?? a.affiliationName ?? "")
      .localeCompare(String(b.affiliationCode ?? b.contractorName ?? b.affiliationName ?? ""));

    if (affiliate !== 0) return affiliate;

    return String(a.techId ?? "").localeCompare(String(b.techId ?? ""));
  });
}

export function buildDispatchBadges(row: ScheduleSurfaceRow) {
  const badges: string[] = [];

  if (row.dispatch.callOut) badges.push("No Show");
  if (row.dispatch.incidentCount > 0) badges.push(`Incident ${row.dispatch.incidentCount}`);
  if (row.dispatch.bpLow) badges.push("BP-Low");
  if (row.dispatch.techMove) badges.push("Move");
  if (row.dispatch.noteCount > 0) badges.push(`Note ${row.dispatch.noteCount}`);
  if (row.dispatch.addIn) badges.push("Add-In");

  return badges;
}
