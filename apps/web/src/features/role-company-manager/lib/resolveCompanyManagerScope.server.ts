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
  office_name?: string | null;
  leader_assignment_id?: string | null;
  leader_person_id?: string | null;
  leader_name?: string | null;
  leader_title?: string | null;
  team_class?: TeamClass;
  contractor_name?: string | null;
};

export type CompanyManagerScopePersonRow = {
  person_id: string;
  full_name: string | null;
  role: string | null;
  co_ref_id: string | null;
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
};

type OfficeRow = {
  office_id: string | null;
  office_name: string | null;
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
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
    const techId = row.tech_id ? String(row.tech_id) : null;
    if (!techId) continue;
    if (!out.has(techId)) out.set(techId, row);
  }

  return [...out.values()];
}

function isItgAssignment(args: {
  assignment: CompanyManagerScopeAssignmentRow;
  person: CompanyManagerScopePersonRow | undefined;
}) {
  const role = String(args.person?.role ?? "").toLowerCase();
  const positionTitle = String(args.assignment.position_title ?? "").toLowerCase();

  return (
    role === "hires" ||
    role === "employee" ||
    role === "employees" ||
    role === "itg" ||
    positionTitle.includes("itg")
  );
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
    if (edge.active === false) continue;

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
    if (edge.active === false) continue;
    out.set(childId, parentId);
  }

  return out;
}

function collectDescendantAssignmentIds(args: {
  seedIds: string[];
  childrenByParent: Map<string, string[]>;
}) {
  const out = new Set<string>();
  const queue = [...args.seedIds];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    if (out.has(current)) continue;

    out.add(current);

    const children = args.childrenByParent.get(current) ?? [];
    for (const childId of children) {
      if (!out.has(childId)) {
        queue.push(childId);
      }
    }
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
    if (managerAssignmentIds.has(cursor)) {
      return null;
    }

    const candidate = assignmentsById.get(cursor);
    if (candidate && isLeadershipDisplayAssignment(candidate)) {
      return candidate;
    }

    cursor = parentByChild.get(cursor) ?? null;
  }

  return null;
}

async function loadContractorLabels(
  admin: ReturnType<typeof supabaseAdmin>,
  contractorIds: string[]
) {
  const out = new Map<string, string>();
  if (!contractorIds.length) return out;

  const { data } = await admin
    .from("contractor_admin_v")
    .select("contractor_id,contractor_name")
    .in("contractor_id", contractorIds);

  for (const row of (data ?? []) as ContractorRow[]) {
    const contractorId = String(row.contractor_id ?? "");
    const contractorName = String(row.contractor_name ?? "").trim();
    if (!contractorId || !contractorName) continue;
    out.set(contractorId, contractorName);
  }

  return out;
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
      .from("person")
      .select("person_id,full_name,role,co_ref_id")
      .eq("person_id", boot.person_id)
      .maybeSingle(),
    admin
      .from("assignment_admin_v")
      .select(
        "assignment_id,person_id,pc_org_id,tech_id,start_date,end_date,position_title,active,office_id"
      )
      .eq("pc_org_id", selected_pc_org_id)
      .eq("active", true),
  ]);

  const me = (meRes.data ?? null) as CompanyManagerScopePersonRow | null;

  if (!me) {
    throw new Error("Unable to resolve current person");
  }

  const allOrgAssignments = (
    (allOrgAssignmentsRes.data ?? []) as CompanyManagerScopeAssignmentRow[]
  ).filter((a) => isActiveWindow(a, today));

  const assignmentsById = new Map<string, CompanyManagerScopeAssignmentRow>();
  for (const row of allOrgAssignments) {
    const assignmentId = String(row.assignment_id ?? "");
    if (!assignmentId) continue;
    assignmentsById.set(assignmentId, row);
  }

  const myAssignments = allOrgAssignments.filter(
    (a) => String(a.person_id ?? "") === String(boot.person_id)
  );

  const myAssignmentIds = myAssignments
    .map((a) => String(a.assignment_id ?? ""))
    .filter(Boolean);

  if (!myAssignmentIds.length) {
    return {
      selected_pc_org_id,
      role_label: "Company Manager",
      rep_full_name: me.full_name ? String(me.full_name) : null,
      company_label: null,
      scoped_assignments: [],
      people_by_id: new Map<string, CompanyManagerScopePersonRow>(),
      org_labels_by_id: await loadOrgLabels(admin, [selected_pc_org_id]),
    };
  }

  const managerAssignmentIdSet = new Set(myAssignmentIds);
  const orgAssignmentIds = Array.from(assignmentsById.keys());

  const leadershipRes = orgAssignmentIds.length
    ? await admin
        .from("assignment_leadership_admin_v")
        .select("parent_assignment_id,child_assignment_id,active")
        .in("parent_assignment_id", orgAssignmentIds)
        .eq("active", true)
    : { data: [] as LeadershipEdgeRow[] };

  const leadershipRows = (leadershipRes.data ?? []) as LeadershipEdgeRow[];
  const childrenByParent = buildChildrenByParent(leadershipRows);
  const parentByChild = buildParentByChild(leadershipRows);

  const descendantAssignmentIds = collectDescendantAssignmentIds({
    seedIds: myAssignmentIds,
    childrenByParent,
  });

  for (const myAssignmentId of myAssignmentIds) {
    descendantAssignmentIds.delete(myAssignmentId);
  }

  const descendantAssignments = Array.from(descendantAssignmentIds)
    .map((id) => assignmentsById.get(id))
    .filter((row): row is CompanyManagerScopeAssignmentRow => !!row);

  const personIds = Array.from(
    new Set(
      allOrgAssignments.map((r) => String(r.person_id ?? "")).filter(Boolean)
    )
  );

  const peopleRes = personIds.length
    ? await admin
        .from("person")
        .select("person_id,full_name,role,co_ref_id")
        .in("person_id", personIds)
    : { data: [] as CompanyManagerScopePersonRow[] };

  const people_by_id = new Map<string, CompanyManagerScopePersonRow>();
  for (const row of (peopleRes.data ?? []) as CompanyManagerScopePersonRow[]) {
    people_by_id.set(String(row.person_id), row);
  }

  const contractorIds = Array.from(
    new Set(
      Array.from(people_by_id.values())
        .filter((person) => String(person.role ?? "") === "Contractors")
        .map((person) => String(person.co_ref_id ?? ""))
        .filter(Boolean)
    )
  );

  const contractorNameById = await loadContractorLabels(admin, contractorIds);

  const officeIds = Array.from(
    new Set(
      allOrgAssignments
        .map((assignment) => String(assignment.office_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const officeNameById = await loadOfficeLabels(admin, officeIds);

  const descendantTechAssignments = descendantAssignments.filter(
    (assignment) => !!assignment.tech_id
  );

  const scoped_assignments = uniqueByTech(
    descendantTechAssignments.map((assignment) => {
      const person = people_by_id.get(String(assignment.person_id ?? ""));
      const isItg = isItgAssignment({ assignment, person });

      const personRole = String(person?.role ?? "");
      const coRefId = String(person?.co_ref_id ?? "");
      const officeId = String(assignment.office_id ?? "").trim();

      const contractor_name =
        !isItg && personRole === "Contractors" && coRefId
          ? contractorNameById.get(coRefId) ?? null
          : null;

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

      return {
        ...assignment,
        office_id: officeId || null,
        office_name,
        leader_assignment_id: leaderAssignment?.assignment_id ?? null,
        leader_person_id: leaderAssignment?.person_id ?? null,
        leader_name: leaderPerson?.full_name ?? null,
        leader_title: leaderAssignment?.position_title ?? null,
        team_class: isItg ? ("ITG" as TeamClass) : ("BP" as TeamClass),
        contractor_name: isItg ? null : contractor_name,
      };
    })
  );

  const org_labels_by_id = await loadOrgLabels(admin, [selected_pc_org_id]);

  return {
    selected_pc_org_id,
    role_label: "Company Manager",
    rep_full_name: me.full_name ? String(me.full_name) : null,
    company_label: null,
    scoped_assignments,
    people_by_id,
    org_labels_by_id,
  };
}