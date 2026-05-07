import type {
  WorkforceRow,
  WorkforceSeatType,
  WorkforceTabKey,
} from "@/shared/types/workforce/workforce.types";

export type WorkforceDraft = {
  position_title: string | null;
  office_id: string | null;
  affiliation_id: string | null;
  reports_to_assignment_id: string | null;
  seat_type: WorkforceSeatType;
  start_date: string | null;
};

export const WORKFORCE_SEAT_OPTIONS: Array<{
  value: WorkforceSeatType;
  label: string;
}> = [
  { value: "FIELD", label: "Field" },
  { value: "LEADERSHIP", label: "Leadership" },
  { value: "SUPPORT", label: "Support" },
  { value: "TRAVEL", label: "Travel Tech" },
  { value: "DROP_BURY", label: "Drop Bury" },
  { value: "TRAINING", label: "Training" },
  { value: "FMLA", label: "FMLA" },
];

export function badgeTone(seatType: WorkforceSeatType) {
  if (seatType === "FIELD") {
    return "border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_10%,white)]";
  }

  if (seatType === "LEADERSHIP") {
    return "border-[var(--to-primary)] bg-[color-mix(in_oklab,var(--to-primary)_10%,white)]";
  }

  if (seatType === "SUPPORT") {
    return "border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_10%,white)]";
  }

  if (seatType === "DROP_BURY") {
    return "border-[var(--to-info)] bg-[color-mix(in_oklab,var(--to-info)_12%,white)]";
  }

  if (seatType === "TRAINING") {
    return "border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_14%,white)]";
  }

  if (seatType === "FMLA") {
    return "border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_10%,white)]";
  }

  return "border-[var(--to-info)] bg-[color-mix(in_oklab,var(--to-info)_10%,white)]";
}

export function tabLabel(key: WorkforceTabKey) {
  if (key === "ALL") return "All";
  if (key === "FIELD") return "Field";
  if (key === "LEADERSHIP") return "Leadership";
  if (key === "PROCESSING") return "Processing";
  if (key === "SUPPORT") return "Support";
  if (key === "DROP_BURY") return "Drop Bury";
  if (key === "TRAINING") return "Training";
  if (key === "FMLA") return "FMLA";
  return "Travel Techs";
}

export function identityLabel(row: WorkforceRow) {
  const lead = row.preferred_name ?? row.first_name ?? row.display_name;

  if (!row.tech_id) return lead;
  if (row.tech_id.startsWith("UNASSIGNED-")) return lead;

  return `${lead} • ${row.tech_id}`;
}

export function buildDraft(row: WorkforceRow): WorkforceDraft {
  return {
    position_title: row.position_title,
    office_id: row.office_id,
    affiliation_id: row.affiliation_id,
    reports_to_assignment_id: row.reports_to_assignment_id,
    seat_type: row.seat_type,
    start_date: row.start_date,
  };
}

export function buildChangeSet(selected: WorkforceRow, draft: WorkforceDraft) {
  const changes: Record<string, unknown> = {};

  if (selected.assignment_id === "NEW") {
    changes.person_id = selected.person_id;
    changes.pc_org_id = selected.pc_org_id;
    changes.tech_id = selected.tech_id;
  }

  if (selected.position_title !== draft.position_title) {
    changes.position_title = draft.position_title;
  }

  if (selected.office_id !== draft.office_id) {
    changes.office_id = draft.office_id;
  }

  if (selected.affiliation_id !== draft.affiliation_id) {
    changes.affiliation_id = draft.affiliation_id;
  }

  if (selected.reports_to_assignment_id !== draft.reports_to_assignment_id) {
    changes.reports_to_assignment_id = draft.reports_to_assignment_id;
  }

  if (selected.seat_type !== draft.seat_type) {
    changes.seat_type = draft.seat_type;
  }

  if (selected.start_date !== draft.start_date) {
    changes.start_date = draft.start_date;
  }

  return changes;
}

export function isDraftDirty(
  selected: WorkforceRow | null,
  draft: WorkforceDraft | null
) {
  if (!selected || !draft) return false;
  return Object.keys(buildChangeSet(selected, draft)).length > 0;
}

export function quickCopyText(
  row: WorkforceRow,
  affiliationLabel?: string | null
) {
  return `${row.display_name} • Tech ID: ${row.tech_id ?? "N/A"}
Mobile:      ${row.mobile ?? "—"}
NT Login:    ${row.nt_login ?? "—"}
CSG:         ${row.csg ?? "—"}
Email:       ${row.email ?? "—"}
Affiliation: ${affiliationLabel ?? row.affiliation ?? "—"}
Reports To:  ${row.reports_to_name ?? "—"}`;
}