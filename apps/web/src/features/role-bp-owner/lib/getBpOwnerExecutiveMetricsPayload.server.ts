// path: apps/web/src/features/role-bp-owner/lib/getBpOwnerExecutiveMetricsPayload.server.ts

import type {
  MetricsRangeKey,
  MetricsSurfacePayload,
} from "@/shared/types/metrics/surfacePayload";

import buildAffiliateExecutiveMetricsPayload from "./buildAffiliateExecutiveMetricsPayload.server";
import { resolveBpOwnerScope } from "./resolveBpOwnerScope.server";

type BpOwnerProfileKey = "NSR" | "SMART";

type Args = {
  profile_key: BpOwnerProfileKey;
  range: MetricsRangeKey;
};

export async function getBpOwnerExecutiveMetricsPayload(
  args: Args,
): Promise<MetricsSurfacePayload> {
  const scope = await resolveBpOwnerScope();

  return buildAffiliateExecutiveMetricsPayload({
    scope,
    profile_key: args.profile_key,
    range: args.range,
  });
}

export default getBpOwnerExecutiveMetricsPayload;