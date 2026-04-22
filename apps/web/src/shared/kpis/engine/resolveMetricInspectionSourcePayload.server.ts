import { resolveInspectionMetricFamily } from "@/shared/kpis/definitions/resolveInspectionMetricFamily";
import type {
  WorkforceInspectionTarget,
} from "@/shared/kpis/contracts/inspectionTypes";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";

import { getMetricPayloadTnps } from "@/shared/kpis/engine/payloads/getMetricPayloadTnps.server";
import { getMetricPayloadFtr } from "@/shared/kpis/engine/payloads/getMetricPayloadFtr.server";
import { getMetricPayloadToolUsage } from "@/shared/kpis/engine/payloads/getMetricPayloadToolUsage.server";
import { getMetricPayloadPurePass } from "@/shared/kpis/engine/payloads/getMetricPayloadPurePass.server";
import { getMetricPayload48Hr } from "@/shared/kpis/engine/payloads/getMetricPayload48Hr.server";
import { getMetricPayloadRepeat } from "@/shared/kpis/engine/payloads/getMetricPayloadRepeat.server";
import { getMetricPayloadSoi } from "@/shared/kpis/engine/payloads/getMetricPayloadSoi.server";
import { getMetricPayloadRework } from "@/shared/kpis/engine/payloads/getMetricPayloadRework.server";
import { getMetricPayloadMet } from "@/shared/kpis/engine/payloads/getMetricPayloadMet.server";

export type ResolveMetricInspectionSourcePayloadArgs = {
  kpi_key: string;
  active_range: MetricsRangeKey;
  target: WorkforceInspectionTarget;
  payload?: unknown;
};

export async function resolveMetricInspectionSourcePayload(
  args: ResolveMetricInspectionSourcePayloadArgs
): Promise<unknown> {
  if (
    args.payload &&
    typeof args.payload === "object" &&
    "trend_points" in (args.payload as any)
  ) {
    return args.payload;
  }

  const metricFamily = resolveInspectionMetricFamily(args.kpi_key);
  const baseArgs = {
    person_id: args.target.person_id,
    tech_id: args.target.tech_id,
    range: args.active_range,
  };

  if (metricFamily === "tnps") {
    return getMetricPayloadTnps(baseArgs);
  }

  if (metricFamily === "ftr") {
    return getMetricPayloadFtr(baseArgs);
  }

  if (metricFamily === "tool_usage") {
    return getMetricPayloadToolUsage(baseArgs);
  }

  if (metricFamily === "pure_pass") {
    return getMetricPayloadPurePass(baseArgs);
  }

  if (metricFamily === "contact_48hr") {
    return getMetricPayload48Hr(baseArgs);
  }

  if (metricFamily === "repeat") {
    return getMetricPayloadRepeat(baseArgs);
  }

  if (metricFamily === "soi") {
    return getMetricPayloadSoi(baseArgs);
  }

  if (metricFamily === "rework") {
    return getMetricPayloadRework(baseArgs);
  }

  if (metricFamily === "met_rate") {
    return getMetricPayloadMet(baseArgs);
  }

  return null;
}