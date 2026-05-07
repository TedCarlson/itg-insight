// path: apps/web/src/features/role-director/lib/getDirectorExecutivePayload.server.ts

import { redirect } from "next/navigation";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { buildExecutiveSuitePayload } from "@/shared/server/executive/buildExecutiveSuitePayload.server";
import { DIRECTOR_EXECUTIVE_SUITE_CONFIG } from "@/shared/server/executive/executiveSuite.config";
import type { MetricsRangeKey } from "@/shared/types/metrics/surfacePayload";

export async function getDirectorExecutivePayload(args: {
  range?: MetricsRangeKey;
}) {
  const selected = await requireSelectedPcOrgServer();

  if (!selected.ok) {
    redirect(selected.reason === "not_authenticated" ? "/login" : "/home");
  }

  return buildExecutiveSuitePayload({
    config: DIRECTOR_EXECUTIVE_SUITE_CONFIG,
    pc_org_id: selected.selected_pc_org_id,
    range: args.range,
  });
}
