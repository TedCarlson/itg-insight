// path: apps/web/src/shared/schedule/server/resolveScheduleScope.server.ts

import {
  requireSelectedPcOrgServer,
} from "@/lib/auth/requireSelectedPcOrg.server";

export type ScheduleScope =
  | "ALL_ORG"
  | "BP_COMPANY"
  | "TECH_SELF";

export type ResolvedScheduleScope = {
  scope: ScheduleScope;

  allowedPcOrgIds: string[];

  contractorId: string | null;

  personId: string | null;
};

export async function resolveScheduleScope(): Promise<ResolvedScheduleScope> {

  const selected =
    await requireSelectedPcOrgServer();

  if (!selected.ok) {
    return {
      scope: "ALL_ORG",
      allowedPcOrgIds: [],
      contractorId: null,
      personId: null,
    };
  }

  return {
    scope: "ALL_ORG",
    allowedPcOrgIds: [
      selected.selected_pc_org_id,
    ],
    contractorId: null,
    personId: null,
  };
}
