// path: apps/web/src/features/role-bp-owner/lib/resolveBpOwnerScope.server.ts

import { bootstrapProfileServer } from "@/lib/auth/bootstrapProfile.server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

type Sb = ReturnType<typeof supabaseAdmin>;

export type BpOwnerScopeRow = {
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
  reports_to_person_id?: string | null;
  reports_to_label?: string | null;
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

type ContractorWorkspaceAssignmentRow = {
  contractor_id: string | null;
  pc_org_id: string | null;
  active: boolean | null;
};

export type BpOwnerScopeResult = {
  selected_pc_org_id: string;
  role_label: "BP Owner";
  rep_full_name: string | null;
  rep_person_id: string | null;
  contractor_id: string | null;
  contractor_name: string | null;
  scoped_assignments: BpOwnerScopeRow[];
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function clean(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next || null;
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

function uniqueByTech(rows: BpOwnerScopeRow[]) {
  const map = new Map<string, BpOwnerScopeRow>();

  for (const row of rows) {
    const tech = clean(row.tech_id);
    if (!tech) continue;
    if (!map.has(tech)) map.set(tech, row);
  }

  return [...map.values()];
}

async function loadContractorName(admin: Sb, contractorId: string) {
  const { data } = await admin
    .from("contractor_admin_v")
    .select("contractor_id,contractor_name")
    .eq("contractor_id", contractorId)
    .maybeSingle();

  const row = (data ?? null) as ContractorRow | null;

  return clean(row?.contractor_name);
}

async function hasActiveContractorCoverage(args: {
  admin: Sb;
  contractorId: string;
  pcOrgId: string;
}) {
  const { data } = await args.admin
    .from("v_contractor_workspace_assignment")
    .select("contractor_id,pc_org_id,active")
    .eq("contractor_id", args.contractorId)
    .eq("pc_org_id", args.pcOrgId)
    .eq("active", true)
    .maybeSingle();

  const row = (data ?? null) as ContractorWorkspaceAssignmentRow | null;

  return (
    clean(row?.contractor_id) === args.contractorId &&
    clean(row?.pc_org_id) === args.pcOrgId &&
    row?.active === true
  );
}

function formatRepName(args: {
  contractorName: string | null;
  repName: string | null;
}) {
  const contractor = clean(args.contractorName);
  const rep = clean(args.repName);

  if (contractor && rep) return `${contractor} • ${rep}`;
  if (contractor) return contractor;
  if (rep) return rep;

  return null;
}

export async function resolveBpOwnerScope(): Promise<BpOwnerScopeResult> {
  const [boot, scope] = await Promise.all([
    bootstrapProfileServer(),
    requireSelectedPcOrgServer(),
  ]);

  if (!boot.ok || !boot.person_id) {
    return {
      selected_pc_org_id: scope.ok ? scope.selected_pc_org_id : "",
      role_label: "BP Owner",
      rep_full_name: null,
      rep_person_id: null,
      contractor_id: null,
      contractor_name: null,
      scoped_assignments: [],
    };
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
  const contractorId = clean(me?.co_ref_id);
  const contractorName = contractorId
    ? await loadContractorName(admin, contractorId)
    : null;

  const baseResult = {
    selected_pc_org_id,
    role_label: "BP Owner" as const,
    rep_full_name: formatRepName({
      contractorName,
      repName: me?.full_name ?? null,
    }),
    rep_person_id: boot.person_id,
    contractor_id: contractorId,
    contractor_name: contractorName,
  };

  if (!contractorId) {
    return {
      ...baseResult,
      contractor_id: null,
      scoped_assignments: [],
    };
  }

  const hasCoverage = await hasActiveContractorCoverage({
    admin,
    contractorId,
    pcOrgId: selected_pc_org_id,
  });

  if (!hasCoverage) {
    return {
      ...baseResult,
      scoped_assignments: [],
    };
  }

  const { data: assignmentsRaw } = await admin
    .from("assignment_admin_v")
    .select(
      "assignment_id, person_id, pc_org_id, tech_id, start_date, end_date, position_title, active, office_id, co_ref_id"
    )
    .eq("pc_org_id", selected_pc_org_id)
    .eq("co_ref_id", contractorId);

  const all = (assignmentsRaw ?? []) as BpOwnerScopeRow[];

  const scopedAssignments = all.filter((row) => isActiveWindow(row, today));

  return {
    ...baseResult,
    scoped_assignments: uniqueByTech(scopedAssignments),
  };
}