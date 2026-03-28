import { sortWorkforceRows } from "@/shared/kpis/core/sortWorkforceRows";
import type { BpViewRosterRow } from "./bpView.types";

type RosterColumn = {
  kpi_key: string;
  label: string;
};

export function sortBpRosterRows(
  rows: BpViewRosterRow[],
  rosterColumns: RosterColumn[]
): BpViewRosterRow[] {
  return sortWorkforceRows(rows, rosterColumns);
}