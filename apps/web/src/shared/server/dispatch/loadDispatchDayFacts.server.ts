import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type DispatchDayFactRow = {
  pc_org_id: string;
  shift_date: string;

  tech_count: number;
  built_count: number;
  checked_in_count: number;

  call_out_count: number;
  add_in_count: number;
  incident_count: number;
  note_count: number;
  net_capacity_delta_routes: number;

  quota_hours: number;
  quota_units: number;
  quota_routes_required: number;
  quota_as_of: string | null;
};

export type DispatchDayFactKey = `${string}:${string}`;

export type DispatchDayFactLookup = Map<DispatchDayFactKey, DispatchDayFactRow>;

export type LoadDispatchDayFactsArgs = {
  pcOrgIds: string[];
  startDate: string;
  endDate: string;
};

type DispatchDaySummaryViewRow = {
  pc_org_id: string | null;
  shift_date: string | null;

  tech_count: number | string | null;
  built_count: number | string | null;
  checked_in_count: number | string | null;

  call_out_count: number | string | null;
  add_in_count: number | string | null;
  incident_count: number | string | null;
  note_count: number | string | null;
  net_capacity_delta_routes: number | string | null;

  quota_hours: number | string | null;
  quota_units: number | string | null;
  quota_routes_required: number | string | null;
  quota_as_of: string | null;
};

const SELECT_COLUMNS = [
  "pc_org_id",
  "shift_date",
  "tech_count",
  "built_count",
  "checked_in_count",
  "call_out_count",
  "add_in_count",
  "incident_count",
  "note_count",
  "net_capacity_delta_routes",
  "quota_hours",
  "quota_units",
  "quota_routes_required",
  "quota_as_of",
].join(",");

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeNumber(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function uniqueClean(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

export function dispatchDayFactKey(args: {
  pc_org_id: string;
  shift_date: string;
}): DispatchDayFactKey {
  return `${args.pc_org_id}:${args.shift_date}`;
}

export function getDispatchDayFact(
  lookup: DispatchDayFactLookup,
  args: { pc_org_id: string; shift_date: string },
): DispatchDayFactRow | null {
  return lookup.get(dispatchDayFactKey(args)) ?? null;
}

export function buildDispatchDayFactLookup(
  rows: DispatchDayFactRow[],
): DispatchDayFactLookup {
  const lookup: DispatchDayFactLookup = new Map();

  for (const row of rows) {
    lookup.set(
      dispatchDayFactKey({
        pc_org_id: row.pc_org_id,
        shift_date: row.shift_date,
      }),
      row,
    );
  }

  return lookup;
}

function normalizeDispatchDayFactRow(
  row: DispatchDaySummaryViewRow,
): DispatchDayFactRow | null {
  const pcOrgId = clean(row.pc_org_id);
  const shiftDate = clean(row.shift_date);

  if (!pcOrgId || !shiftDate) return null;

  return {
    pc_org_id: pcOrgId,
    shift_date: shiftDate,

    tech_count: normalizeNumber(row.tech_count),
    built_count: normalizeNumber(row.built_count),
    checked_in_count: normalizeNumber(row.checked_in_count),

    call_out_count: normalizeNumber(row.call_out_count),
    add_in_count: normalizeNumber(row.add_in_count),
    incident_count: normalizeNumber(row.incident_count),
    note_count: normalizeNumber(row.note_count),
    net_capacity_delta_routes: normalizeNumber(row.net_capacity_delta_routes),

    quota_hours: normalizeNumber(row.quota_hours),
    quota_units: normalizeNumber(row.quota_units),
    quota_routes_required: normalizeNumber(row.quota_routes_required),
    quota_as_of: row.quota_as_of ?? null,
  };
}

export async function loadDispatchDayFacts(
  args: LoadDispatchDayFactsArgs,
): Promise<DispatchDayFactRow[]> {
  const pcOrgIds = uniqueClean(args.pcOrgIds);
  const startDate = clean(args.startDate);
  const endDate = clean(args.endDate);

  if (!pcOrgIds.length) return [];

  if (!isIsoDate(startDate)) {
    throw new Error("loadDispatchDayFacts requires ISO startDate");
  }

  if (!isIsoDate(endDate)) {
    throw new Error("loadDispatchDayFacts requires ISO endDate");
  }

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("dispatch_day_summary_v")
    .select(SELECT_COLUMNS)
    .in("pc_org_id", pcOrgIds)
    .gte("shift_date", startDate)
    .lte("shift_date", endDate)
    .order("shift_date", { ascending: true })
    .order("pc_org_id", { ascending: true });

  if (error) {
    throw new Error(`Dispatch day facts lookup failed: ${error.message}`);
  }

  return ((data ?? []) as unknown as DispatchDaySummaryViewRow[])
    .map(normalizeDispatchDayFactRow)
    .filter((row): row is DispatchDayFactRow => row !== null);
}

export async function loadDispatchDayFactLookup(
  args: LoadDispatchDayFactsArgs,
): Promise<DispatchDayFactLookup> {
  const rows = await loadDispatchDayFacts(args);
  return buildDispatchDayFactLookup(rows);
}