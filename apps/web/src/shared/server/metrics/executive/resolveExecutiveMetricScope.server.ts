// path: apps/web/src/shared/server/metrics/executive/resolveExecutiveMetricScope.server.ts

import type {
  ExecutiveMetricFilters,
  ExecutiveMetricRole,
  ExecutiveMetricScope,
} from "./types";

type ResolveExecutiveMetricScopeArgs = {
  role: ExecutiveMetricRole;

  contractor_id?: string | null;

  covered_pc_org_ids: string[];

  eligible_person_ids?: string[];
  eligible_tech_ids?: string[];

  filters: ExecutiveMetricFilters;
};

export async function resolveExecutiveMetricScope(
  args: ResolveExecutiveMetricScopeArgs
): Promise<ExecutiveMetricScope> {
  if (args.role === "BP_OWNER") {
    return {
      scope_kind: "CONTRACTOR",
      role: args.role,

      contractor_id: args.contractor_id ?? null,

      covered_pc_org_ids: args.covered_pc_org_ids,

      eligible_person_ids: args.eligible_person_ids ?? [],
      eligible_tech_ids: args.eligible_tech_ids ?? [],

      filters: args.filters,
    };
  }

  if (args.role === "DIRECTOR") {
    return {
      scope_kind: "REGION",
      role: args.role,

      covered_pc_org_ids: args.covered_pc_org_ids,

      eligible_person_ids: args.eligible_person_ids ?? [],
      eligible_tech_ids: args.eligible_tech_ids ?? [],

      filters: args.filters,
    };
  }

  return {
    scope_kind: "DIVISION",
    role: args.role,

    covered_pc_org_ids: args.covered_pc_org_ids,

    eligible_person_ids: args.eligible_person_ids ?? [],
    eligible_tech_ids: args.eligible_tech_ids ?? [],

    filters: args.filters,
  };
}

export default resolveExecutiveMetricScope;