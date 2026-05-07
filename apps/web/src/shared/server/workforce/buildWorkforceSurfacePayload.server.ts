// path: apps/web/src/shared/server/workforce/buildWorkforceSurfacePayload.server.ts

import { supabaseServer } from "@/shared/data/supabase/server";
import { buildDisplayName } from "./buildDisplayName";
import type {
  WorkforceAffiliationOption,
  WorkforceSurfacePayload,
} from "@/shared/types/workforce/surfacePayload";
import type {
  WorkforceRow,
  WorkforceScheduleDay,
  WorkforceSeatType,
} from "@/shared/types/workforce/workforce.types";
import { isActiveWorkforceRow } from "@/shared/lib/workforce/workforceEligibility";

export type WorkforceSourceRow = {
  assignment_id: string;
  person_id: string;
  workspace_id?: string | null;
  pc_org_id?: string | null;

  tech_id?: string | null;

  full_name?: string | null;
  legal_name?: string | null;
  first_name?: string | null;
  preferred_name?: string | null;
  last_name?: string | null;

  office_id?: string | null;
  office?: string | null;

  reports_to_assignment_id?: string | null;
  reports_to_person_id?: string | null;
  reports_to_name?: string | null;

  mobile?: string | null;
  email?: string | null;
  nt_login?: string | null;
  csg?: string | null;

  position_title?: string | null;
  role_type?: string | null;
  affiliation_id?: string | null;
  affiliation?: string | null;

  start_date?: string | null;
  end_date?: string | null;

  assignment_status?: string | null;
  person_status?: string | null;
  is_primary?: boolean | null;

  is_active?: boolean | null;
  is_travel_tech?: boolean | null;

  is_field?: boolean | null;
  is_leadership?: boolean | null;
  is_incomplete?: boolean | null;

  schedule?: WorkforceScheduleDay[] | null;
};

function clean(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next ? next : null;
}

function normalizeSchedule(
  value: WorkforceSourceRow["schedule"]
): WorkforceScheduleDay[] {
  const fallback: WorkforceScheduleDay[] = [
    { day: "U", state: "UNKNOWN" },
    { day: "M", state: "UNKNOWN" },
    { day: "T", state: "UNKNOWN" },
    { day: "W", state: "UNKNOWN" },
    { day: "H", state: "UNKNOWN" },
    { day: "F", state: "UNKNOWN" },
    { day: "S", state: "UNKNOWN" },
  ];

  if (!Array.isArray(value) || value.length === 0) return fallback;

  const byDay = new Map<string, WorkforceScheduleDay>();
  for (const item of value) {
    if (!item?.day) continue;
    byDay.set(item.day, item);
  }

  return fallback.map((base) => byDay.get(base.day) ?? base);
}

function classifySeatType(row: WorkforceSourceRow): WorkforceSeatType {
  const roleType = clean(row.role_type)?.toUpperCase();

  if (roleType === "TRAVEL") return "TRAVEL";
  if (roleType === "FIELD") return "FIELD";
  if (roleType === "LEADERSHIP") return "LEADERSHIP";
  if (roleType === "SUPPORT") return "SUPPORT";
  if (roleType === "DROP_BURY") return "DROP_BURY";
  if (roleType === "TRAINING") return "TRAINING";
  if (roleType === "FMLA") return "FMLA";

  const title = clean(row.position_title)?.toLowerCase() ?? "";

  if (row.is_travel_tech) return "TRAVEL";
  if (row.is_field === true) return "FIELD";
  if (row.is_leadership === true) return "LEADERSHIP";

  if (
    title.includes("drop bury") ||
    title.includes("drop-bury") ||
    title.includes("drop_bury")
  ) {
    return "DROP_BURY";
  }

  if (
    title.includes("supervisor") ||
    title.includes("manager") ||
    title.includes("owner") ||
    title.includes("lead") ||
    title.includes("director")
  ) {
    return "LEADERSHIP";
  }

  if (
    title.includes("training") ||
    title.includes("trainee")
  ) {
    return "TRAINING";
  }

  if (title.includes("technician") || title.includes("field")) {
    return "FIELD";
  }

  return "SUPPORT";
}

function buildSearchableText(row: WorkforceRow): string {
  return [
    row.display_name,
    row.tech_id,
    row.office,
    row.reports_to_name,
    row.position_title,
    row.mobile,
    row.email,
    row.nt_login,
    row.csg,
    row.affiliation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function toWorkforceRow(row: WorkforceSourceRow): WorkforceRow {
  const first_name = clean(row.first_name);
  const preferred_name = clean(row.preferred_name);
  const last_name = clean(row.last_name);
  const full_name = clean(row.full_name);
  const legal_name = clean(row.legal_name);

  const display_name =
    full_name ??
    buildDisplayName({
      preferred_name,
      first_name,
      last_name,
    });

  const base: WorkforceRow = {
    assignment_id: String(row.assignment_id ?? "").trim(),
    person_id: String(row.person_id ?? "").trim(),
    workspace_id: clean(row.workspace_id),
    pc_org_id: clean(row.pc_org_id),

    tech_id: clean(row.tech_id),

    full_name,
    legal_name,
    first_name,
    preferred_name,
    last_name,
    display_name,

    office_id: clean(row.office_id),
    office: clean(row.office),

    reports_to_assignment_id: clean(row.reports_to_assignment_id),
    reports_to_person_id: clean(row.reports_to_person_id),
    reports_to_name: clean(row.reports_to_name),

    schedule: normalizeSchedule(row.schedule ?? null),

    seat_type: classifySeatType(row),

    mobile: clean(row.mobile),
    email: clean(row.email),
    nt_login: clean(row.nt_login),
    csg: clean(row.csg),

    position_title: clean(row.position_title),
    affiliation_id: clean(row.affiliation_id),
    affiliation: clean(row.affiliation),

    start_date: clean(row.start_date),
    end_date: clean(row.end_date),

    assignment_status: clean(row.assignment_status),
    person_status: clean(row.person_status),
    is_primary: row.is_primary === true,

    is_active: row.is_active !== false,
    is_travel_tech: row.is_travel_tech === true,
    is_incomplete: row.is_incomplete === true,

    searchable_text: "",
  };

  return {
    ...base,
    searchable_text: buildSearchableText(base),
  };
}

function uniqueOptions(values: (string | null | undefined)[]) {
  const set = new Set<string>();

  for (const value of values) {
    const next = clean(value);
    if (!next) continue;
    set.add(next);
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

async function loadPositionOptions() {
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("assignment")
    .select("position_title")
    .not("position_title", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return uniqueOptions((data ?? []).map((row) => row.position_title)).map(
    (value) => ({
      value,
      label: value,
    })
  );
}

async function loadAffiliationOptions() {
  const sb = await supabaseServer();

  const { data, error } = await sb.rpc("workforce_affiliation_options");

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as WorkforceAffiliationOption[]).map((row) => ({
    affiliation_id: row.affiliation_id,
    affiliation_type: row.affiliation_type,
    affiliation_code: row.affiliation_code,
    affiliation_label: row.affiliation_label,
  }));
}

function buildOfficeOptions(rows: WorkforceRow[]) {
  const byId = new Map<string, string>();

  for (const row of rows) {
    if (!row.office_id || !row.office) continue;
    byId.set(row.office_id, row.office);
  }

  return Array.from(byId.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function hasDirectReports(rows: WorkforceRow[], assignmentId: string) {
  return rows.some((row) => row.reports_to_assignment_id === assignmentId);
}

function isLeadershipTitle(value: string | null | undefined) {
  const title = String(value ?? "").toLowerCase();

  return (
    title.includes("owner") ||
    title.includes("supervisor") ||
    title.includes("lead") ||
    title.includes("manager") ||
    title.includes("director")
  );
}

function buildReportsToOptions(rows: WorkforceRow[]) {
  return rows
    .filter((row) => {
      if (!row.is_active) return false;

      return (
        row.seat_type === "LEADERSHIP" ||
        isLeadershipTitle(row.position_title) ||
        hasDirectReports(rows, row.assignment_id)
      );
    })
    .map((row) => ({
      value: row.assignment_id,
      label: row.display_name,
      helper: [row.position_title, row.affiliation].filter(Boolean).join(" • "),
      assignment_id: row.assignment_id,
      person_id: row.person_id,
      affiliation: row.affiliation,
      position_title: row.position_title,
      seat_type: row.seat_type,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildSliceOptions(
  rows: WorkforceRow[],
  getValue: (row: WorkforceRow) => string | null
): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = getValue(row);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function buildWorkforceSurfacePayload(args: {
  rows: WorkforceSourceRow[];
}): Promise<WorkforceSurfacePayload> {
  const today = new Date().toISOString().slice(0, 10);

  const rows = (args.rows ?? [])

    .map(toWorkforceRow)

    .filter((row) => isActiveWorkforceRow(row, today));

  const field = rows.filter((row) => row.seat_type === "FIELD").length;
  const leadership = rows.filter(
    (row) => row.seat_type === "LEADERSHIP"
  ).length;
  const support = rows.filter((row) => row.seat_type === "SUPPORT").length;
  const incomplete = rows.filter((row) => row.is_incomplete).length;
  const travel = rows.filter((row) => row.seat_type === "TRAVEL").length;
  const dropBury = rows.filter((row) => row.seat_type === "DROP_BURY").length;
  const training = rows.filter((row) => row.seat_type === "TRAINING").length;
  const fmla = rows.filter((row) => row.seat_type === "FMLA").length;

  const positions = await loadPositionOptions();
  const affiliations = await loadAffiliationOptions();

  return {
    rows,
    tabs: [
      { key: "ALL", label: "All", count: rows.length },
      { key: "FIELD", label: "Field", count: field },
      { key: "TRAINING", label: "Training", count: training },
      { key: "LEADERSHIP", label: "Leadership", count: leadership },
      { key: "INCOMPLETE", label: "Incomplete", count: incomplete },
      { key: "TRAVEL", label: "Travel Techs", count: travel },
      { key: "DROP_BURY", label: "Drop Bury", count: dropBury },
      { key: "FMLA", label: "FMLA", count: fmla },
    ],
    summary: {
      total: rows.length,
      field,
      training,
      leadership,
      support,
      incomplete,
      travel,
      drop_bury: dropBury,
      fmla,
    },
    slices: {
      offices: buildSliceOptions(rows, (row) => row.office),
      reportsTo: buildSliceOptions(rows, (row) => row.reports_to_name),
      positions: buildSliceOptions(rows, (row) => row.position_title),
      affiliations: buildSliceOptions(rows, (row) => row.affiliation),
      seatTypes: buildSliceOptions(rows, (row) => row.seat_type),
    },
    editOptions: {
      positions,
      offices: buildOfficeOptions(rows),
      reportsTo: buildReportsToOptions(rows),
      affiliations,
    },
  };
}