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

type ContractorAssignmentRow = {
  contractor_id: string | null;
  pc_org_id: string | null;
  start_date: string | null;
  end_date: string | null;
};

type AssignmentRow = {
  assignment_id: string | null;
  person_id: string | null;
  pc_org_id: string | null;
  tech_id: string | null;
  start_date: string | null;
  end_date: string | null;
  position_title: string | null;
  active: boolean | null;
  office_id: string | null;
};

export type BpOwnerScopeResult = {
  selected_pc_org_id: string;
  covered_pc_org_ids: string[];
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

function uniqueByAssignment(rows: BpOwnerScopeRow[]) {
  const map = new Map<string, BpOwnerScopeRow>();

  for (const row of rows) {
    const key =
      clean(row.assignment_id) ??
      clean(row.tech_id) ??
      clean(row.person_id);

    if (!key) continue;
    if (!map.has(key)) map.set(key, row);
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

async function loadCoveredOrgIds(args: {
  admin: Sb;
  contractorId: string;
  today: string;
}) {
  const { data } = await args.admin
    .from("contractor_assignment_v")
    .select("contractor_id,pc_org_id,start_date,end_date")
    .eq("contractor_id", args.contractorId);

  const rows = (data ?? []) as ContractorAssignmentRow[];

  return Array.from(
    new Set(
      rows
        .filter((row) =>
          isActiveWindow(
            {
              active: true,
              start_date: row.start_date,
              end_date: row.end_date,
            },
            args.today
          )
        )
        .map((row) => clean(row.pc_org_id))
        .filter(Boolean)
    )
  ) as string[];
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

  if (!scope.ok) {
    throw new Error("No org selected");
  }

  if (!boot.ok || !boot.person_id) {
    return {
      selected_pc_org_id: scope.selected_pc_org_id,
      covered_pc_org_ids: [],
      role_label: "BP Owner",
      rep_full_name: null,
      rep_person_id: null,
      contractor_id: null,
      contractor_name: null,
      scoped_assignments: [],
    };
  }

  const admin = supabaseAdmin();
  const today = isoToday();

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
    selected_pc_org_id: scope.selected_pc_org_id,
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
      covered_pc_org_ids: [],
      scoped_assignments: [],
    };
  }

  const coveredPcOrgIds = await loadCoveredOrgIds({
    admin,
    contractorId,
    today,
  });

  if (!coveredPcOrgIds.length) {
    return {
      ...baseResult,
      covered_pc_org_ids: [],
      scoped_assignments: [],
    };
  }

  const { data: assignmentsRaw } = await admin
    .from("assignment_admin_v")
    .select(
      "assignment_id, person_id, pc_org_id, tech_id, start_date, end_date, position_title, active, office_id"
    )
    .in("pc_org_id", coveredPcOrgIds)
    .eq("active", true);

  const assignments = ((assignmentsRaw ?? []) as AssignmentRow[]).filter((row) =>
    isActiveWindow(row, today)
  );

  const personIds = Array.from(
    new Set(assignments.map((row) => clean(row.person_id)).filter(Boolean))
  );

  if (!personIds.length) {
    return {
      ...baseResult,
      covered_pc_org_ids: coveredPcOrgIds,
      scoped_assignments: [],
    };
  }

  const { data: peopleRaw } = await admin
    .from("person")
    .select("person_id, full_name, co_ref_id")
    .in("person_id", personIds);

  const people = (peopleRaw ?? []) as PersonRow[];
  const peopleById = new Map(
    people.map((person) => [clean(person.person_id), person])
  );

  const scopedAssignments: BpOwnerScopeRow[] = [];

  for (const assignment of assignments) {
    const personId = clean(assignment.person_id);
    const person = personId ? peopleById.get(personId) : null;

    if (clean(person?.co_ref_id) !== contractorId) continue;

    scopedAssignments.push({
      assignment_id: assignment.assignment_id,
      person_id: assignment.person_id,
      pc_org_id: assignment.pc_org_id,
      tech_id: assignment.tech_id,
      position_title: assignment.position_title,
      active: assignment.active,
      start_date: assignment.start_date,
      end_date: assignment.end_date,
      office_id: assignment.office_id,
      co_ref_id: contractorId,
    });
  }

  return {
    ...baseResult,
    covered_pc_org_ids: coveredPcOrgIds,
    scoped_assignments: uniqueByAssignment(scopedAssignments),
  };
}