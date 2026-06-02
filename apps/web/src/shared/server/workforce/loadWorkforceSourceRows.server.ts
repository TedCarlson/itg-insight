// path: apps/web/src/shared/server/workforce/loadWorkforceSourceRows.server.ts

import { supabaseServer } from "@/shared/data/supabase/server";
import type { WorkforceSourceRow } from "./buildWorkforceSurfacePayload.server";

type HydratedIdentity = {
  person_id: string;
  full_name: string | null;
  legal_name: string | null;
  preferred_name: string | null;
  status: string | null;
  mobile: string | null;
  email: string | null;
  tech_id: string | null;
  nt_login: string | null;
  csg: string | null;
};

type WorkforceCurrentViewRow = {
  assignment_id: string;
  person_id: string;
  workspace_id: string;
  pc_org_id: string | null;

  tech_id: string | null;
  full_name: string | null;
  legal_name: string | null;
  preferred_name: string | null;
  person_status: string | null;

  mobile: string | null;
  email: string | null;
  nt_login: string | null;
  csg: string | null;

  affiliation_code: string | null;
  affiliation_id: string | null;
  affiliation: string | null;

  position_title: string | null;
  role_type: string | null;

  office_id: string | null;
  office_name: string | null;

  reports_to_assignment_id: string | null;
  reports_to_person_id: string | null;
  reports_to_full_name: string | null;

  assignment_status: string | null;
  start_date: string | null;
  end_date: string | null;
  is_primary: boolean | null;
  is_active: boolean | null;
  is_incomplete: boolean | null;
};

function splitName(fullName: string | null | undefined): {
  first_name: string | null;
  last_name: string | null;
} {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return { first_name: null, last_name: null };
  if (parts.length === 1) return { first_name: parts[0] ?? null, last_name: null };

  return {
    first_name: parts[0] ?? null,
    last_name: parts.slice(1).join(" ") || null,
  };
}

function overlapsAsOfDate(args: {
  start_date: string | null;
  end_date: string | null;
  as_of_date: string;
}) {
  const startOk = !args.start_date || args.start_date <= args.as_of_date;
  const endOk = !args.end_date || args.end_date >= args.as_of_date;
  return startOk && endOk;
}

function isActiveAsOf(row: WorkforceCurrentViewRow, asOfDate: string) {
  return (
    row.assignment_status === "active" &&
    overlapsAsOfDate({
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
      as_of_date: asOfDate,
    })
  );
}

export async function loadWorkforceSourceRows(args: {
  pc_org_id: string;
  as_of_date: string;
}): Promise<WorkforceSourceRow[]> {
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("workforce_current_v")
    .select(`
      assignment_id,
      person_id,
      workspace_id,
      pc_org_id,
      tech_id,
      full_name,
      legal_name,
      preferred_name,
      person_status,
      mobile,
      email,
      nt_login,
      csg,
      affiliation_code,
      affiliation,
      affiliation_id,
      position_title,
      role_type,
      office_id,
      office_name,
      reports_to_assignment_id,
      reports_to_person_id,
      reports_to_full_name,
      assignment_status,
      start_date,
      end_date,
      is_primary,
      is_active,
      is_incomplete
    `)
    .eq("pc_org_id", args.pc_org_id)
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as WorkforceCurrentViewRow[];
  const personIds = Array.from(new Set(rows.map((row) => row.person_id).filter(Boolean)));

  const identityByPersonId = new Map<string, HydratedIdentity>();

  if (personIds.length > 0) {
    const { data: identityData, error: identityError } = await sb
      .from("workforce_person_identity_v")
      .select("person_id, full_name, legal_name, preferred_name, status, mobile, email, tech_id, nt_login, csg")
      .in("person_id", personIds);

    if (identityError) throw new Error(identityError.message);

    for (const identity of (identityData ?? []) as HydratedIdentity[]) {
      identityByPersonId.set(identity.person_id, identity);
    }
  }

  return rows
    .filter((row) =>
      overlapsAsOfDate({
        start_date: row.start_date ?? null,
        end_date: row.end_date ?? null,
        as_of_date: args.as_of_date,
      })
    )
    .map((row) => {
      const identity = identityByPersonId.get(row.person_id) ?? null;
      const fullName = identity?.full_name ?? row.full_name;
      const { first_name, last_name } = splitName(fullName);
      const activeAsOf = isActiveAsOf(row, args.as_of_date);

      return {
        assignment_id: row.assignment_id,
        person_id: row.person_id,
        workspace_id: row.workspace_id,
        pc_org_id: row.pc_org_id ?? null,

        tech_id: identity?.tech_id ?? row.tech_id ?? null,

        full_name: fullName ?? null,
        legal_name: identity?.legal_name ?? row.legal_name ?? null,
        first_name,
        preferred_name: identity?.preferred_name ?? row.preferred_name ?? null,
        last_name,

        office_id: row.office_id ?? null,
        office: row.office_name ?? null,

        reports_to_assignment_id: row.reports_to_assignment_id ?? null,
        reports_to_person_id: row.reports_to_person_id ?? null,
        reports_to_name: row.reports_to_full_name ?? null,

        mobile: identity?.mobile ?? row.mobile ?? null,
        email: identity?.email ?? row.email ?? null,
        nt_login: identity?.nt_login ?? row.nt_login ?? null,
        csg: identity?.csg ?? row.csg ?? null,

        position_title: row.position_title ?? null,
        role_type: row.role_type ?? null,
        affiliation_id: row.affiliation_id ?? null,
        affiliation: row.affiliation ?? null,

        start_date: row.start_date ?? null,
        end_date: row.end_date ?? null,

        assignment_status: row.assignment_status ?? null,
        person_status: identity?.status ?? row.person_status ?? null,
        is_primary: row.is_primary === true,

        is_active: activeAsOf,
        is_travel_tech: row.role_type === "TRAVEL",

        is_field: row.role_type === "FIELD",
        is_leadership: row.role_type === "LEADERSHIP",
        is_incomplete: activeAsOf ? row.is_incomplete === true : false,

        schedule: null,
      };
    });
}
