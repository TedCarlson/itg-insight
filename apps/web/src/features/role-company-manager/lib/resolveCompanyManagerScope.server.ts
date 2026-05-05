// path: apps/web/src/features/role-company-manager/lib/resolveCompanyManagerScope.server.ts

import { bootstrapProfileServer } from "@/lib/auth/bootstrapProfile.server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

type TeamClass = "ITG" | "BP";

export type CompanyManagerScopeAssignmentRow = {
  assignment_id: string | null;
  person_id: string | null;
  pc_org_id: string | null;
  tech_id: string | null;
  position_title: string | null;
  active: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
  office_id?: string | null;
  reports_to_assignment_id?: string | null;

  office_name?: string | null;
  leader_assignment_id?: string | null;
  leader_person_id?: string | null;
  leader_name?: string | null;
  leader_title?: string | null;
  team_class?: TeamClass;
  contractor_name?: string | null;
  supervisor_chain_person_ids?: string[];
};

export type CompanyManagerScopePersonRow = {
  person_id: string;
  full_name: string | null;
  status: string | null;
  prospecting_affiliation_id: string | null;
};

export type CompanyManagerScopeRole = "Company Manager";

export type CompanyManagerScopeResult = {
  selected_pc_org_id: string;
  role_label: CompanyManagerScopeRole;
  rep_full_name: string | null;
  company_label: string | null;
  scoped_assignments: CompanyManagerScopeAssignmentRow[];
  people_by_id: Map<string, CompanyManagerScopePersonRow>;
  org_labels_by_id: Map<string, string>;
};

type LeadershipEdgeRow = {
  parent_assignment_id: string | null;
  child_assignment_id: string | null;
  active: boolean | null;
};

type ContractorRow = {
  contractor_id: string | null;
  contractor_name: string | null;
  contractor_code?: string | null;
};

type ContractorMeta = {
  contractor_name: string | null;
  contractor_code: string | null;
};

type OfficeRow = {
  office_id: string | null;
  office_name: string | null;
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: string | null | undefined) {
  const v = String(value ?? "").trim();
  return v || null;
}

function compareNullableDatesDesc(
  a: string | null | undefined,
  b: string | null | undefined
) {
  const av = normalizeDate(a);
  const bv = normalizeDate(b);
  if (av && bv) return bv.localeCompare(av);
  if (av) return -1;
  if (bv) return 1;
  return 0;
}

function isActiveWindow(
  row: {
    active?: boolean | null;
    start_date?: string | null;
    end_date?: string | null;
  },
  today: string
) {
  const activeOk = row.active === true || row.active == null;
  const startOk = !row.start_date || String(row.start_date) <= today;
  const endOk = !row.end_date || String(row.end_date) >= today;
  return activeOk && startOk && endOk;
}

async function loadOrgLabels(
  admin: ReturnType<typeof supabaseAdmin>,
  pcOrgIds: string[]
) {
  const out = new Map<string, string>();
  if (!pcOrgIds.length) return out;

  const { data } = await admin
    .from("pc_org")
    .select("pc_org_id,pc_org_name")
    .in("pc_org_id", pcOrgIds);

  for (const row of data ?? []) {
    if (row?.pc_org_id) {
      out.set(
        String(row.pc_org_id),
        row?.pc_org_name ? String(row.pc_org_name) : String(row.pc_org_id)
      );
    }
  }

  for (const id of pcOrgIds) {
    if (!out.has(id)) out.set(id, id);
  }

  return out;
}

async function loadOfficeLabels(
  admin: ReturnType<typeof supabaseAdmin>,
  officeIds: string[]
) {
  const out = new Map<string, string>();
  if (!officeIds.length) return out;

  const { data } = await admin
    .from("office")
    .select("office_id,office_name")
    .in("office_id", officeIds);

  for (const row of (data ?? []) as OfficeRow[]) {
    const officeId = String(row.office_id ?? "").trim();
    const officeName = String(row.office_name ?? "").trim();
    if (!officeId || !officeName) continue;
    out.set(officeId, officeName);
  }

  return out;
}

function uniqueByTech(rows: CompanyManagerScopeAssignmentRow[]) {
  const out = new Map<string, CompanyManagerScopeAssignmentRow>();

  for (const row of rows) {
    const techId = row.tech_id ? String(row.tech_id).trim() : null;
    if (!techId) continue;
    if (!out.has(techId)) out.set(techId, row);
  }

  return [...out.values()];
}

function isLeadershipDisplayAssignment(
  assignment: CompanyManagerScopeAssignmentRow
) {
  const title = String(assignment.position_title ?? "").toLowerCase();

  if (!title) return false;
  if (title.includes("technician")) return false;

  return (
    title.includes("supervisor") ||
    title.includes("lead") ||
    title.includes("owner") ||
    title.includes("manager")
  );
}

function buildChildrenByParent(edges: LeadershipEdgeRow[]) {
  const out = new Map<string, string[]>();

  for (const edge of edges) {
    const parentId = String(edge.parent_assignment_id ?? "");
    const childId = String(edge.child_assignment_id ?? "");
    if (!parentId || !childId) continue;
    if (edge.active !== true) continue;

    const arr = out.get(parentId) ?? [];
    arr.push(childId);
    out.set(parentId, arr);
  }

  return out;
}

function buildParentByChild(edges: LeadershipEdgeRow[]) {
  const out = new Map<string, string>();

  for (const edge of edges) {
    const parentId = String(edge.parent_assignment_id ?? "");
    const childId = String(edge.child_assignment_id ?? "");
    if (!parentId || !childId) continue;
    if (edge.active !== true) continue;

    out.set(childId, parentId);
  }

  return out;
}

function resolveNearestLeader(args: {
  assignmentId: string;
  parentByChild: Map<string, string>;
  assignmentsById: Map<string, CompanyManagerScopeAssignmentRow>;
  managerAssignmentIds: Set<string>;
}) {
  const {
    assignmentId,
    parentByChild,
    assignmentsById,
    managerAssignmentIds,
  } = args;

  let cursor = parentByChild.get(assignmentId) ?? null;

  while (cursor) {
    if (managerAssignmentIds.has(cursor)) return null;

    const candidate = assignmentsById.get(cursor);
    if (candidate && isLeadershipDisplayAssignment(candidate)) {
      return candidate;
    }

    cursor = parentByChild.get(cursor) ?? null;
  }

  return null;
}

function buildSupervisorChain(args: {
  assignmentId: string;
  parentByChild: Map<string, string>;
  assignmentsById: Map<string, CompanyManagerScopeAssignmentRow>;
}) {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cursor = args.parentByChild.get(args.assignmentId) ?? null;

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);

    const assignment = args.assignmentsById.get(cursor);
    if (!assignment) break;

    const personId = String(assignment.person_id ?? "").trim();
    if (personId) chain.push(personId);

    cursor = args.parentByChild.get(cursor) ?? null;
  }

  return chain;
}

async function loadContractorLabels(
  admin: ReturnType<typeof supabaseAdmin>,
  contractorIds: string[]
) {
  const out = new Map<string, ContractorMeta>();
  if (!contractorIds.length) return out;

  const { data } = await admin
    .from("contractor_admin_v")
    .select("contractor_id,contractor_name,contractor_code")
    .in("contractor_id", contractorIds);

  for (const row of (data ?? []) as ContractorRow[]) {
    const contractorId = String(row.contractor_id ?? "").trim();
    if (!contractorId) continue;

    out.set(contractorId, {
      contractor_name: String(row.contractor_name ?? "").trim() || null,
      contractor_code: String(row.contractor_code ?? "").trim() || null,
    });
  }

  return out;
}

function resolveTeamClass(meta: ContractorMeta | undefined): TeamClass {
  const code = String(meta?.contractor_code ?? "").trim().toUpperCase();
  const name = String(meta?.contractor_name ?? "").trim().toLowerCase();

  if (code === "ITG" || name === "integrated tech group") return "ITG";
  return "BP";
}

export async function resolveCompanyManagerScope(): Promise<CompanyManagerScopeResult> {
  const [boot, scope] = await Promise.all([
    bootstrapProfileServer(),
    requireSelectedPcOrgServer(),
  ]);

  if (!boot.ok || !boot.person_id) {
    throw new Error("No linked person profile");
  }

  if (!scope.ok) {
    throw new Error("No org selected");
  }

  const admin = supabaseAdmin();
  const today = isoToday();
  const selected_pc_org_id = scope.selected_pc_org_id;

  const [meRes, allOrgAssignmentsRes] = await Promise.all([
    admin
      .from("people")
      .select("person_id,full_name,status,prospecting_affiliation_id")
      .eq("person_id", boot.person_id)
      .maybeSingle(),
    admin
      .schema("core")
      .from("assignments")
      .select(
        "assignment_id,person_id,workspace_id,tech_id,start_date,end_date,position_title,assignment_status,office_id,reports_to_assignment_id"
      )
      .eq("workspace_id", selected_pc_org_id),
  ]);

  const me = (meRes.data ?? null) as {
    person_id: string;
    full_name: string | null;
    role: string | null;
  } | null;

  const repFullName = me?.full_name ?? null;

  const allOrgAssignmentsRaw = ((allOrgAssignmentsRes.data ?? []) as any[])
    .map((row): CompanyManagerScopeAssignmentRow => ({
      assignment_id: row.assignment_id ?? null,
      person_id: row.person_id ?? null,
      pc_org_id: row.workspace_id ?? null,
      tech_id: row.tech_id ?? null,
      position_title: row.position_title ?? null,
      active: row.assignment_status === "active",
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
      office_id: row.office_id ?? null,
      reports_to_assignment_id: row.reports_to_assignment_id ?? null,
    }))
    .filter((a) => {
      const startOk = !a.start_date || String(a.start_date) <= today;
      const endOk = !a.end_date || String(a.end_date) >= today;
      return startOk && endOk;
    });

  const allOrgAssignments = allOrgAssignmentsRaw
    .filter((a) => isActiveWindow(a, today))
    .sort((a, b) => {
      const aHasTech = a.tech_id ? 1 : 0;
      const bHasTech = b.tech_id ? 1 : 0;
      if (bHasTech !== aHasTech) return bHasTech - aHasTech;

      const aActive = a.active === true ? 1 : 0;
      const bActive = b.active === true ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;

      return compareNullableDatesDesc(a.start_date, b.start_date);
    });

  const assignmentsById = new Map<string, CompanyManagerScopeAssignmentRow>();

  for (const row of allOrgAssignments) {
    const assignmentId = String(row.assignment_id ?? "").trim();
    if (!assignmentId) continue;
    assignmentsById.set(assignmentId, row);
  }

  const myAssignments = allOrgAssignments.filter(
    (a) => String(a.person_id ?? "") === String(boot.person_id)
  );

  const myAssignmentIds = myAssignments
    .map((a) => String(a.assignment_id ?? "").trim())
    .filter(Boolean);

  const managerAssignmentIdSet = new Set(myAssignmentIds);

  const leadershipRows: LeadershipEdgeRow[] = allOrgAssignments
    .map((assignment) => ({
      parent_assignment_id: assignment.reports_to_assignment_id ?? null,
      child_assignment_id: assignment.assignment_id ?? null,
      active: assignment.active,
    }))
    .filter(
      (edge) =>
        Boolean(edge.parent_assignment_id) &&
        Boolean(edge.child_assignment_id) &&
        edge.active === true
    );

  const childrenByParent = buildChildrenByParent(leadershipRows);
  const parentByChild = buildParentByChild(leadershipRows);

  const orgTechAssignments = allOrgAssignments.filter((assignment) => {
    const techId = String(assignment.tech_id ?? "").trim();
    if (!techId) return false;
    if (techId.startsWith("UNASSIGNED-")) return false;

    return true;
  });

  const basePersonIds = new Set(
    allOrgAssignments.map((r) => String(r.person_id ?? "")).filter(Boolean)
  );

  for (const assignment of allOrgAssignments) {
    const assignmentId = String(assignment.assignment_id ?? "");
    if (!assignmentId) continue;

    const leaderAssignment = resolveNearestLeader({
      assignmentId,
      parentByChild,
      assignmentsById,
      managerAssignmentIds: managerAssignmentIdSet,
    });

    if (leaderAssignment?.person_id) {
      basePersonIds.add(String(leaderAssignment.person_id));
    }
  }

  const personIds = Array.from(basePersonIds);

  const peopleRes = personIds.length
    ? await admin
      .schema("core")
      .from("people")
      .select("person_id,full_name,status,prospecting_affiliation_id")
      .in("person_id", personIds)
    : { data: [] as CompanyManagerScopePersonRow[] };

  const people_by_id = new Map<string, CompanyManagerScopePersonRow>();

  for (const row of (peopleRes.data ?? []) as CompanyManagerScopePersonRow[]) {
    people_by_id.set(String(row.person_id), row);
  }

  const contractorIds = Array.from(
    new Set(
      Array.from(people_by_id.values())
        .map((person) => String(person.prospecting_affiliation_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const contractorById = await loadContractorLabels(admin, contractorIds);

  const officeIds = Array.from(
    new Set(
      allOrgAssignments
        .map((assignment) => String(assignment.office_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const officeNameById = await loadOfficeLabels(admin, officeIds);

  const scoped_assignments = uniqueByTech(
    orgTechAssignments.map((assignment) => {
      const person = people_by_id.get(String(assignment.person_id ?? ""));
      const affiliationId = String(
        person?.prospecting_affiliation_id ?? ""
      ).trim();

      const contractorMeta = affiliationId
        ? contractorById.get(affiliationId)
        : undefined;

      const teamClass = resolveTeamClass(contractorMeta);
      const officeId = String(assignment.office_id ?? "").trim();

      const office_name = officeId ? officeNameById.get(officeId) ?? null : null;

      const assignmentId = String(assignment.assignment_id ?? "");
      const leaderAssignment = assignmentId
        ? resolveNearestLeader({
          assignmentId,
          parentByChild,
          assignmentsById,
          managerAssignmentIds: managerAssignmentIdSet,
        })
        : null;

      const leaderPerson = leaderAssignment
        ? people_by_id.get(String(leaderAssignment.person_id ?? ""))
        : null;

      const supervisor_chain_person_ids = assignmentId
        ? buildSupervisorChain({
          assignmentId,
          parentByChild,
          assignmentsById,
        })
        : [];

      return {
        ...assignment,
        office_id: officeId || null,
        office_name,
        leader_assignment_id: leaderAssignment?.assignment_id ?? null,
        leader_person_id: leaderAssignment?.person_id ?? null,
        leader_name: leaderPerson?.full_name ?? null,
        leader_title: leaderAssignment?.position_title ?? null,
        team_class: teamClass,
        contractor_name:
          teamClass === "BP" ? contractorMeta?.contractor_name ?? null : null,
        supervisor_chain_person_ids,
      };
    })
  );

  const org_labels_by_id = await loadOrgLabels(admin, [selected_pc_org_id]);

  return {
    selected_pc_org_id,
    role_label: "Company Manager",
    rep_full_name: repFullName ? String(repFullName) : null,
    company_label: null,
    scoped_assignments,
    people_by_id,
    org_labels_by_id,
  };
}