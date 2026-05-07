// path: apps/web/src/shared/server/executive/buildExecutiveSuitePayload.server.ts

import type { ExecutiveSuiteConfig } from "./executiveSuite.config";
import { buildMetricsExecutiveDimension } from "./pipelines/metricsExecutivePipeline.server";
import { buildRouteLockExecutiveDimension } from "./pipelines/routeLockExecutivePipeline.server";
import { buildWorkforceExecutiveDimension } from "./pipelines/workforceExecutivePipeline.server";
import type { ExecutiveDimensionPayload, ExecutiveSuitePayload } from "@/shared/types/executive/executiveSuite";
import type { MetricsRangeKey } from "@/shared/types/metrics/surfacePayload";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function disabledDimension(key: string): ExecutiveDimensionPayload {
  return {
    dimension: key as ExecutiveDimensionPayload["dimension"],
    title: key,
    status: "not_wired",
    artifacts: [],
  };
}

export async function buildExecutiveSuitePayload(args: {
  config: ExecutiveSuiteConfig;
  pc_org_id: string;
  range?: MetricsRangeKey;
  as_of_date?: string;
}): Promise<ExecutiveSuitePayload> {
  const range = args.range ?? args.config.default_range;
  const asOfDate = args.as_of_date ?? todayIso();
  const dimensions: ExecutiveDimensionPayload[] = [];

  for (const dimension of args.config.dimensions) {
    if (!dimension.enabled) {
      dimensions.push(disabledDimension(dimension.key));
      continue;
    }

    if (dimension.key === "workforce") {
      dimensions.push(await buildWorkforceExecutiveDimension({ pc_org_id: args.pc_org_id, as_of_date: asOfDate }));
      continue;
    }

    if (dimension.key === "metrics") {
      dimensions.push(await buildMetricsExecutiveDimension({ pc_org_id: args.pc_org_id, as_of_date: asOfDate, range }));
      continue;
    }

    if (dimension.key === "route_lock") {
      dimensions.push(await buildRouteLockExecutiveDimension({ pc_org_id: args.pc_org_id, as_of_date: asOfDate }));
      continue;
    }

    dimensions.push(disabledDimension(dimension.key));
  }

  return {
    header: {
      consumer_key: args.config.consumer_key,
      consumer_label: args.config.consumer_label,
      pc_org_id: args.pc_org_id,
      as_of_date: asOfDate,
      range,
    },
    dimensions,
  };
}
