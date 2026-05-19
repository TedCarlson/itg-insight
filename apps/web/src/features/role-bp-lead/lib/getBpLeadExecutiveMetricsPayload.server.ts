// path: apps/web/src/features/role-bp-lead/lib/getBpLeadExecutiveMetricsPayload.server.ts

import type {
  MetricsRangeKey,
  MetricsSurfacePayload,
} from "@/shared/types/metrics/surfacePayload";

import buildAffiliateExecutiveMetricsPayload from "@/features/role-bp-owner/lib/buildAffiliateExecutiveMetricsPayload.server";
import { resolveBpLeadScope } from "./resolveBpLeadScope.server";

type BpLeadProfileKey = "NSR" | "SMART";

type Args = {
  profile_key: BpLeadProfileKey;
  range: MetricsRangeKey;
};

export async function getBpLeadExecutiveMetricsPayload(
  args: Args,
): Promise<MetricsSurfacePayload> {
  const scope = await resolveBpLeadScope();

  return buildAffiliateExecutiveMetricsPayload({
    scope,
    profile_key: args.profile_key,
    range: args.range,
  });
}

export default getBpLeadExecutiveMetricsPayload;