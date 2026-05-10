// path: apps/web/src/features/role-bp-owner/lib/getBpOwnerSurfacePayload.server.ts

import type {
  MetricsRangeKey,
  MetricsSurfacePayload,
} from "@/shared/types/metrics/surfacePayload";
import getBpOwnerExecutiveMetricsPayload from "./getBpOwnerExecutiveMetricsPayload.server";

type BpOwnerProfileKey = "NSR" | "SMART";

function normalizeProfileKey(
  value: string | null | undefined
): BpOwnerProfileKey {
  return String(value ?? "NSR").trim().toUpperCase() === "SMART"
    ? "SMART"
    : "NSR";
}

function normalizeRangeKey(value: string | null | undefined): MetricsRangeKey {
  const upper = String(value ?? "FM").trim().toUpperCase();

  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";

  return "FM";
}

export async function getBpOwnerSurfacePayload(args?: {
  profile_key?: string | null;
  range?: string | null;
}): Promise<MetricsSurfacePayload> {
  return getBpOwnerExecutiveMetricsPayload({
    profile_key: normalizeProfileKey(args?.profile_key),
    range: normalizeRangeKey(args?.range),
  });
}

export default getBpOwnerSurfacePayload;