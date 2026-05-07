// path: apps/web/src/shared/server/executive/executiveSuite.config.ts

import type { ExecutiveConsumerKey, ExecutiveDimensionKey } from "@/shared/types/executive/executiveSuite";
import type { MetricsRangeKey } from "@/shared/types/metrics/surfacePayload";

export type ExecutiveDimensionConfig = {
  key: ExecutiveDimensionKey;
  enabled: boolean;
  artifacts: string[];
};

export type ExecutiveSuiteConfig = {
  consumer_key: ExecutiveConsumerKey;
  consumer_label: string;
  default_range: MetricsRangeKey;
  dimensions: ExecutiveDimensionConfig[];
};

export const DIRECTOR_EXECUTIVE_SUITE_CONFIG: ExecutiveSuiteConfig = {
  consumer_key: "DIRECTOR",
  consumer_label: "Director",
  default_range: "FM",
  dimensions: [
    {
      key: "workforce",
      enabled: true,
      artifacts: ["headcount", "leadership_structure", "assignment_health"],
    },
    {
      key: "metrics",
      enabled: true,
      artifacts: ["kpi_summary", "risk_focus", "rankings"],
    },
    {
      key: "route_lock",
      enabled: true,
      artifacts: ["capacity_plan", "schedule_health", "route_coverage"],
    },
  ],
};
