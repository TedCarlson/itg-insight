// path: apps/web/src/features/role-bp-supervisor/lib/resolveBpSupervisorScope.server.ts

import { bootstrapProfileServer } from "@/lib/auth/bootstrapProfile.server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

type Sb = ReturnType<typeof supabaseAdmin>;

export type BpSupervisorScopeRow = {
  assignment_id: string | null;
  person_id: string | null;
  pc_org_id: string | null;
  tech_id: string | null;
  position_title: string | null;
  active: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
  office_id?: string | null;
  co_ref_id?: string | null;
};

type LeadershipEdgeRow = {
  parent_assignment_id: string | null;
  child_assignment_id: string | null;
  active: boolean | null;
};

type PersonRow = {
  person_id: string;
  full_name: string | null;
  co_ref_id: string | null;
};

type ContractorRow = {
  contractor_id: string | null;
  contractor_name: string | null;
};

export type BpSupervisorScopeResult = {
  selected_pc_org_id: string;
  role_label: "BP Supervisor";
  rep_full_name: string | null;
  rep_person_id: string | null;
  scoped_assignments: BpSupervisorScopeRow[];
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

function buildChildrenByParent(edges: LeadershipEdgeRow[]) {
  const out = new Map<string, string[]>();

  for (const edge of edges) {
    const parent = String(edge.parent_assignment_id ?? "").trim();
    const child = String(edge.child_assignment_id ?? "").trim();

    if (!parent || !child) continue;
    if (edge.active === false) continue;

    const arr = out.get(parent) ?? [];
    arr.push(child);
    out.set(parent, arr);
  }

  return out;
}

function collectDescendants(
  seeds: string[],
  childrenByParent: Map<string, string[]>
) {
  const visited = new Set<string>();
  const queue = [...seeds];

  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;

    visited.add(current);

    const children = childrenByParent.get(current) ?? [];
    for (const child of children) {
      if (!visited.has(child)) queue.push(child);
    }
  }

  return visited;
}

function uniqueByTech(rows: BpSupervisorScopeRow[]) {
  const map = new Map<string, BpSupervisorScopeRow>();

  for (const row of rows) {
    const tech = String(row.tech_id ?? "").trim();
    if (!tech) continue;

    if (!map.has(tech)) map.set(tech, row);
  }

  return [...map.values()];
}

function formatRepName(args: {
  affiliateName: string | null;
  repName: string | null;
}) {
  const affiliate = String(args.affiliateName ?? "").trim();
  const rep = String(args.repName ?? "").trim();

  if (affiliate && rep) return `${affiliate} • ${rep}`;
  if (rep) return rep;
  if (affiliate) return affiliate;
  return null;
}

async function loadContractorName(admin: Sb, contractorId: string) {
  const { data } = await admin
    .from("contractor_admin_v")
    .select("contractor_id,contractor_name")
    .eq("contractor_id", contractorId)
    .maybeSingle();

  const row = (data ?? null) as ContractorRow | null;
  return String(row?.contractor_name ?? "").trim() || null;
}

export async function resolveBpSupervisorScope(): Promise<BpSupervisorScopeResult> {
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

  const { data: meData } = await admin
    .from("person")
    .select("person_id, full_name, co_ref_id")
    .eq("person_id", boot.person_id)
    .maybeSingle();

  const me = (meData ?? null) as PersonRow | null;
  const contractorId = String(me?.co_ref_id ?? "").trim();
  const contractorName = contractorId
    ? await loadContractorName(admin, contractorId)
    : null;

  if (!contractorId) {
    return {
      selected_pc_org_id,
      role_label: "BP Supervisor",
      rep_full_name: formatRepName({
        affiliateName: contractorName,
        repName: me?.full_name ?? null,
      }),
      rep_person_id: boot.person_id,
      scoped_assignments: [],
    };
  }

  const { data: assignmentsRaw } = await admin
    .from("assignment_admin_v")
    .select(
      "assignment_id, person_id, pc_org_id, tech_id, start_date, end_date, position_title, active, office_id, co_ref_id"
    )
    .eq("pc_org_id", selected_pc_org_id);

  const all = (assignmentsRaw ?? []) as BpSupervisorScopeRow[];

  const contractorAssignments = all
    .filter((row) => isActiveWindow(row, today))
    .filter((row) => String(row.co_ref_id ?? "").trim() === contractorId);

  const myAssignments = contractorAssignments.filter(
    (row) => String(row.person_id ?? "").trim() === boot.person_id
  );

  const myIds = myAssignments
    .map((r) => String(r.assignment_id ?? "").trim())
    .filter(Boolean);

  if (!myIds.length) {
    return {
      selected_pc_org_id,
      role_label: "BP Supervisor",
      rep_full_name: formatRepName({
        affiliateName: contractorName,
        repName: me?.full_name ?? null,
      }),
      rep_person_id: boot.person_id,
      scoped_assignments: [],
    };
  }

  const byId = new Map<string, BpSupervisorScopeRow>();

  for (const row of contractorAssignments) {
    const id = String(row.assignment_id ?? "").trim();
    if (id) byId.set(id, row);
  }

  const ids = Array.from(byId.keys());

  const { data: edgesRaw } = await admin
    .from("assignment_leadership_admin_v")
    .select("parent_assignment_id, child_assignment_id, active")
    .in("parent_assignment_id", ids)
    .in("child_assignment_id", ids)
    .eq("active", true);

  const edges = (edgesRaw ?? []) as LeadershipEdgeRow[];
  const childrenByParent = buildChildrenByParent(edges);
  const descendantIds = collectDescendants(myIds, childrenByParent);

  myIds.forEach((id) => descendantIds.add(id));

  const scopedRows = Array.from(descendantIds)
    .map((id) => byId.get(id))
    .filter((r): r is BpSupervisorScopeRow => !!r);

  return {
    selected_pc_org_id,
    role_label: "BP Supervisor",
    rep_full_name: formatRepName({
      affiliateName: contractorName,
      repName: me?.full_name ?? null,
    }),
    rep_person_id: boot.person_id,
    scoped_assignments: uniqueByTech(scopedRows),
  };
}