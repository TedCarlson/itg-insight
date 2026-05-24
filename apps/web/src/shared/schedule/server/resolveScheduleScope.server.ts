// path: apps/web/src/shared/schedule/server/resolveScheduleScope.server.ts

import { bootstrapProfileServer } from "@/lib/auth/bootstrapProfile.server";

import {
  requireSelectedPcOrgServer,
} from "@/shared/lib/auth/requireSelectedPcOrg.server";

import {
  resolveBpOwnerScope,
} from "@/features/role-bp-owner/lib/resolveBpOwnerScope.server";

import {
  resolveBpLeadScope,
} from "@/features/role-bp-lead/lib/resolveBpLeadScope.server";

import {
  resolveBpSupervisorScope,
} from "@/features/role-bp-supervisor/lib/resolveBpSupervisorScope.server";

export type ScheduleScope =
  | "ALL_ORG"
  | "BP_COMPANY"
  | "BP_SUPERVISOR"
  | "TECH_SELF";

export type ResolvedScheduleScope = {
  scope: ScheduleScope;

  allowedPcOrgIds: string[];

  contractorId: string | null;

  personId: string | null;

  assignmentIds: string[];
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function resolveScheduleScope(): Promise<ResolvedScheduleScope> {

  const [boot, selected] = await Promise.all([
    bootstrapProfileServer(),
    requireSelectedPcOrgServer(),
  ]);

  if (!selected.ok) {
    return {
      scope: "ALL_ORG",
      allowedPcOrgIds: [],
      contractorId: null,
      personId: null,
      assignmentIds: [],
    };
  }

  try {

    const scope =
      await resolveBpOwnerScope();

    if (scope.contractor_id) {
      return {
        scope: "BP_COMPANY",

        allowedPcOrgIds:
          scope.covered_pc_org_ids,

        contractorId:
          scope.contractor_id,

        personId:
          scope.rep_person_id,

        assignmentIds:
          scope.scoped_assignments
            .map((row) => clean(row.assignment_id))
            .filter(Boolean),
      };
    }

  } catch {}

  try {

    const scope =
      await resolveBpLeadScope();

    if (scope.contractor_id) {
      return {
        scope: "BP_COMPANY",

        allowedPcOrgIds:
          scope.covered_pc_org_ids,

        contractorId:
          scope.contractor_id,

        personId:
          scope.rep_person_id,

        assignmentIds:
          scope.scoped_assignments
            .map((row) => clean(row.assignment_id))
            .filter(Boolean),
      };
    }

  } catch {}

  try {

    const scope =
      await resolveBpSupervisorScope();

    if (scope.scoped_assignments.length) {
      return {
        scope: "BP_SUPERVISOR",

        allowedPcOrgIds: [
          scope.selected_pc_org_id,
        ],

        contractorId: null,

        personId:
          scope.rep_person_id,

        assignmentIds:
          scope.scoped_assignments
            .map((row) => clean(row.assignment_id))
            .filter(Boolean),
      };
    }

  } catch {}

  return {
    scope: "ALL_ORG",

    allowedPcOrgIds: [
      selected.selected_pc_org_id,
    ],

    contractorId: null,

    personId:
      clean(boot?.person_id),

    assignmentIds: [],
  };
}
