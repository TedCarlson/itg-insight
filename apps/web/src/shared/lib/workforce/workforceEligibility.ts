// path: apps/web/src/shared/lib/workforce/workforceEligibility.ts

import type { WorkforceRow } from "@/shared/types/workforce/workforce.types";

type DateLike = string | null | undefined;

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isActiveWorkforceRow(row: WorkforceRow, today: string) {
  if (row.person_status && row.person_status !== "active") return false;
  if (row.assignment_status && row.assignment_status !== "active") return false;
  if (row.end_date && row.end_date <= today) return false;

  return true;
}

export function isActiveFieldOrTravelWorkforceRow(
  row: WorkforceRow,
  today: string
) {
  if (!isActiveWorkforceRow(row, today)) return false;

  return row.seat_type === "FIELD" || row.seat_type === "TRAVEL";
}

export function isMetricsEligibleWorkforceWindow(args: {
  start_date: DateLike;
  end_date: DateLike;
  metrics_range_start: string;
  metrics_range_end: string;
  trailing_days?: number;
}) {
  const trailingDays = args.trailing_days ?? 30;

  const assignmentStart = args.start_date ?? "1900-01-01";
  const assignmentEnd = args.end_date ?? "9999-12-31";
  const trailingEnd = addDays(args.metrics_range_end, trailingDays);

  const overlapsMetricsRange =
    assignmentStart <= args.metrics_range_end &&
    assignmentEnd >= args.metrics_range_start;

  const endedWithinTrailingWindow =
    Boolean(args.end_date) &&
    args.end_date! >= args.metrics_range_start &&
    args.end_date! <= trailingEnd;

  return overlapsMetricsRange || endedWithinTrailingWindow;
}