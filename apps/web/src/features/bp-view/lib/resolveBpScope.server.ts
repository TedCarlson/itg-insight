import { bootstrapProfileServer } from "@/lib/auth/bootstrapProfile.server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type BpScopeAssignmentRow = {
  assignment_id: string | null;
  person_id: string | null;
  pc_org_id: string | null;
  tech_id: string | null;
  position_title: string | null;
  active: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type BpScopePersonRow = {
  person_id: string;
  full_name: string | null;
  role: string | null;
  co_ref_id: string | null;
};

export type BpScopeRole = "BP Supervisor" | "BP Lead" | "BP Owner";

export type BpScopeResult = {
  selected_pc_org_id: string;
  role_label: BpScopeRole;
  company_label: string | null;
  company_id: string | null;
  org_labels_by_id: Map<string, string>;
  scoped_assignments: BpScopeAssignmentRow[];
  people_by_id: Map<string, BpScopePersonRow>;
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isActiveWindow(row: {
  active?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
}, today: string) {
  const activeOk = row.active === true || row.active == null;
  const startOk = !row.start_date || String(row.start_date) <= today;
  const endOk = !row.end_date || String(row.end_date) >= today;
  return activeOk && startOk && endOk;
}

function resolveRoleLabel(assignments: BpScopeAssignmentRow[]): BpScopeRole | null {
  const titles = new Set(
    assignments
      .map((a) => (a.position_title ? String(a.position_title).trim() : null))
      .filter((v): v is string => !!v)
  );

  if (titles.has("BP Owner")) return "BP Owner";
  if (titles.has("BP Lead")) return "BP Lead";
  if (titles.has("BP Supervisor")) return "BP Supervisor";
  return null;
}

async function loadCompanyLabel(company_id: string | null): Promise<string | null> {
  if (!company_id) return null;

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("company_admin_v")
    .select("company_name")
    .eq("company_id", company_id)
    .maybeSingle();

  return data?.company_name ? String(data.company_name) : null;
}

async function loadOrgLabels(admin: ReturnType<typeof supabaseAdmin>, pcOrgIds: string[]) {
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

function uniqueByTech(rows: BpScopeAssignmentRow[]) {
  const out = new Map<string, BpScopeAssignmentRow>();
  for (const row of rows) {
    const techId = row.tech_id ? String(row.tech_id) : null;
    if (!techId) continue;
    if (!out.has(techId)) out.set(techId, row);
  }
  return [...out.values()];
}

export async function resolveBpScope(): Promise<BpScopeResult> {
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

  const [personRes, myAssignmentsRes] = await Promise.all([
    admin
      .from("person")
      .select("person_id,full_name,role,co_ref_id")
      .eq("person_id", boot.person_id)
      .maybeSingle(),
    admin
      .from("assignment_admin_v")
      .select("assignment_id,person_id,pc_org_id,tech_id,start_date,end_date,position_title,active")
      .eq("person_id", boot.person_id)
      .eq("active", true),
  ]);

  const me = (personRes.data ?? null) as BpScopePersonRow | null;
  const myAssignments = ((myAssignmentsRes.data ?? []) as BpScopeAssignmentRow[]).filter((a) =>
    isActiveWindow(a, today)
  );

  if (!me) {
    throw new Error("Unable to resolve current person");
  }

  const role_label = resolveRoleLabel(myAssignments);
  if (!role_label) {
    throw new Error("User is not authorized for BP view");
  }

  const company_id = me.co_ref_id ? String(me.co_ref_id) : null;
  const company_label = await loadCompanyLabel(company_id);

  if (!company_id) {
    return {
      selected_pc_org_id,
      role_label,
      company_label,
      company_id: null,
      org_labels_by_id: new Map([[selected_pc_org_id, selected_pc_org_id]]),
      scoped_assignments: [],
      people_by_id: new Map<string, BpScopePersonRow>(),
    };
  }

  const baseAssignmentsQuery = admin
    .from("assignment_admin_v")
    .select("assignment_id,person_id,pc_org_id,tech_id,start_date,end_date,position_title,active")
    .eq("active", true)
    .not("tech_id", "is", null);

  const assignmentsRes =
    role_label === "BP Supervisor"
      ? await baseAssignmentsQuery.eq("pc_org_id", selected_pc_org_id)
      : await baseAssignmentsQuery;

  const allCandidateAssignments = ((assignmentsRes.data ?? []) as BpScopeAssignmentRow[]).filter((a) =>
    isActiveWindow(a, today)
  );

  const candidateAssignments = uniqueByTech(allCandidateAssignments);

  const personIds = Array.from(
    new Set(candidateAssignments.map((r) => String(r.person_id ?? "")).filter(Boolean))
  );

  const peopleRes = personIds.length
    ? await admin
        .from("person")
        .select("person_id,full_name,role,co_ref_id")
        .in("person_id", personIds)
    : { data: [] as BpScopePersonRow[] };

  const people_by_id = new Map<string, BpScopePersonRow>();
  for (const row of (peopleRes.data ?? []) as BpScopePersonRow[]) {
    people_by_id.set(String(row.person_id), row);
  }

  let reportingAssignmentIds = new Set<string>();

  if (role_label === "BP Supervisor") {
    const mySelectedAssignments = myAssignments.filter(
      (a) => String(a.pc_org_id ?? "") === String(selected_pc_org_id)
    );

    const supervisorAssignmentId = mySelectedAssignments[0]?.assignment_id ?? null;

    if (supervisorAssignmentId) {
      const { data: leadershipRows } = await admin
        .from("assignment_leadership_admin_v")
        .select("child_assignment_id")
        .eq("parent_assignment_id", supervisorAssignmentId)
        .eq("active", true);

      for (const row of leadershipRows ?? []) {
        if (row?.child_assignment_id) {
          reportingAssignmentIds.add(String(row.child_assignment_id));
        }
      }
    }
  }

  const scoped_assignments = candidateAssignments.filter((assignment) => {
    const personId = assignment.person_id ? String(assignment.person_id) : null;
    if (!personId) return false;

    const person = people_by_id.get(personId);
    if (!person) return false;

    const role = String(person.role ?? "");
    const co = String(person.co_ref_id ?? "");

    const affiliationMatch =
      co !== "" &&
      co === company_id &&
      (role === "Hires" || role === "Contractors");

    if (role_label === "BP Supervisor") {
      const reportingMatch =
        assignment.assignment_id != null &&
        reportingAssignmentIds.has(String(assignment.assignment_id));

      return (
        String(assignment.pc_org_id ?? "") === String(selected_pc_org_id) &&
        (affiliationMatch || reportingMatch)
      );
    }

    return affiliationMatch;
  });

  const orgIds = Array.from(
    new Set(scoped_assignments.map((r) => String(r.pc_org_id ?? "")).filter(Boolean))
  );

  const org_labels_by_id = await loadOrgLabels(admin, orgIds.length ? orgIds : [selected_pc_org_id]);

  return {
    selected_pc_org_id,
    role_label,
    company_label,
    company_id,
    org_labels_by_id,
    scoped_assignments,
    people_by_id,
  };
}