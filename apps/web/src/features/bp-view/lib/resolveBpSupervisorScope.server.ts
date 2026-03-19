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
};

export type BpScopePersonRow = {
  person_id: string;
  full_name: string | null;
  role: string | null;
  co_ref_id: string | null;
};

export type BpSupervisorScope = {
  selected_pc_org_id: string;
  org_label: string;
  company_label: string | null;
  role_label: string;
  supervisor_company_id: string | null;
  scoped_assignments: BpScopeAssignmentRow[];
  people_by_id: Map<string, BpScopePersonRow>;
};

async function loadPcOrgLabel(pc_org_id: string): Promise<string> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("pc_org")
    .select("pc_org_name")
    .eq("pc_org_id", pc_org_id)
    .maybeSingle();

  return data?.pc_org_name ? String(data.pc_org_name) : pc_org_id;
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

function resolveRoleLabel(assignments: BpScopeAssignmentRow[]): string {
  const titles = new Set(
    assignments
      .map((a) => (a.position_title ? String(a.position_title).trim() : null))
      .filter((v): v is string => !!v)
  );

  if (titles.has("BP Owner")) return "BP Owner";
  if (titles.has("BP Supervisor")) return "BP Supervisor";
  return "BP View";
}

export async function resolveBpSupervisorScope(): Promise<BpSupervisorScope> {
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
  const selected_pc_org_id = scope.selected_pc_org_id;

  const [org_label, supervisorPersonRes, myAssignmentsRes] = await Promise.all([
    loadPcOrgLabel(selected_pc_org_id),
    admin
      .from("person")
      .select("person_id,full_name,role,co_ref_id")
      .eq("person_id", boot.person_id)
      .maybeSingle(),
    admin
      .from("assignment_admin_v")
      .select("assignment_id,person_id,pc_org_id,tech_id,position_title,active")
      .eq("person_id", boot.person_id)
      .eq("pc_org_id", selected_pc_org_id)
      .eq("active", true),
  ]);

  const supervisor = (supervisorPersonRes.data ?? null) as BpScopePersonRow | null;
  const myAssignments = (myAssignmentsRes.data ?? []) as BpScopeAssignmentRow[];

  if (!supervisor) {
    throw new Error("Unable to resolve current person");
  }

  const role_label = resolveRoleLabel(myAssignments);
  if (role_label !== "BP Supervisor" && role_label !== "BP Owner") {
    throw new Error("User is not authorized for BP view");
  }

  const supervisor_company_id = supervisor.co_ref_id
    ? String(supervisor.co_ref_id)
    : null;

  const [company_label, techAssignmentsRes] = await Promise.all([
    loadCompanyLabel(supervisor_company_id),
    admin
      .from("assignment_admin_v")
      .select("assignment_id,person_id,pc_org_id,tech_id,position_title,active")
      .eq("pc_org_id", selected_pc_org_id)
      .eq("active", true)
      .not("tech_id", "is", null),
  ]);

  const techAssignments = (techAssignmentsRes.data ?? []) as BpScopeAssignmentRow[];
  const uniqueByTech = new Map<string, BpScopeAssignmentRow>();

  for (const row of techAssignments) {
    const tech_id = row.tech_id ? String(row.tech_id) : null;
    if (!tech_id) continue;
    if (!uniqueByTech.has(tech_id)) uniqueByTech.set(tech_id, row);
  }

  const candidateAssignments = [...uniqueByTech.values()];
  const personIds = Array.from(
    new Set(candidateAssignments.map((r) => String(r.person_id ?? "")).filter(Boolean))
  );

  const peopleRes = personIds.length
    ? await admin
        .from("person")
        .select("person_id,full_name,role,co_ref_id")
        .in("person_id", personIds)
    : { data: [] as BpScopePersonRow[] };

  const peopleRows = (peopleRes.data ?? []) as BpScopePersonRow[];
  const people_by_id = new Map<string, BpScopePersonRow>();
  for (const row of peopleRows) {
    people_by_id.set(String(row.person_id), row);
  }

  const supervisorAssignmentId = myAssignments[0]?.assignment_id ?? null;
  const reportingAssignmentIds = new Set<string>();

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

  const scoped_assignments = candidateAssignments.filter((assignment) => {
    const person_id = assignment.person_id ? String(assignment.person_id) : null;
    if (!person_id) return false;

    const person = people_by_id.get(person_id);
    if (!person) return false;

    const role = String(person.role ?? "");
    const co = String(person.co_ref_id ?? "");

    const affiliationMatch =
      co !== "" &&
      co === String(supervisor_company_id ?? "") &&
      (role === "Hires" || role === "Contractors");

    const reportingMatch =
      assignment.assignment_id != null &&
      reportingAssignmentIds.has(String(assignment.assignment_id));

    return affiliationMatch || reportingMatch;
  });

  return {
    selected_pc_org_id,
    org_label,
    company_label,
    role_label,
    supervisor_company_id,
    scoped_assignments,
    people_by_id,
  };
}