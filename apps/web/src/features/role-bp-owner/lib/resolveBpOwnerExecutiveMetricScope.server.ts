// path: apps/web/src/features/role-bp-owner/lib/resolveBpOwnerExecutiveMetricScope.server.ts

import type { MetricsRangeKey } from "@/shared/types/metrics/surfacePayload";
import resolveExecutiveMetricScope from "@/shared/server/metrics/executive/resolveExecutiveMetricScope.server";
import { resolveBpOwnerScope } from "./resolveBpOwnerScope.server";

type Args = {
  range: MetricsRangeKey;
  class_type?: "NSR" | "SMART" | null;
  org_id?: string | null;
  supervisor_person_id?: string | null;
  search?: string | null;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function resolveBpOwnerExecutiveMetricScope(args: Args) {
  const bpScope = await resolveBpOwnerScope();

  const eligiblePersonIds = Array.from(
    new Set(
      bpScope.scoped_assignments
        .map((row) => clean(row.person_id))
        .filter(Boolean)
    )
  );

  const eligibleTechIds = Array.from(
    new Set(
      bpScope.scoped_assignments
        .map((row) => clean(row.tech_id))
        .filter(Boolean)
    )
  );

  return resolveExecutiveMetricScope({
    role: "BP_OWNER",
    contractor_id: bpScope.contractor_id,
    covered_pc_org_ids: bpScope.covered_pc_org_ids,
    eligible_person_ids: eligiblePersonIds,
    eligible_tech_ids: eligibleTechIds,
    filters: {
      range: args.range,
      class_type: args.class_type ?? null,
      org_id: args.org_id ?? null,
      supervisor_person_id: args.supervisor_person_id ?? null,
      search: args.search ?? null,
    },
  });
}

export default resolveBpOwnerExecutiveMetricScope;