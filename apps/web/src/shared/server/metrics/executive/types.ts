// path: apps/web/src/shared/server/metrics/executive/types.ts

import type { MetricsRangeKey } from "@/shared/types/metrics/surfacePayload";

export type ExecutiveScopeKind =
  | "CONTRACTOR"
  | "ORG"
  | "REGION"
  | "DIVISION";

export type ExecutiveMetricRole =
  | "BP_OWNER"
  | "DIRECTOR"
  | "VP";

export type ExecutiveMetricFilters = {
  range: MetricsRangeKey;

  org_id?: string | null;
  region_id?: string | null;

  supervisor_person_id?: string | null;

  class_type?: "NSR" | "SMART" | null;

  search?: string | null;
};

export type ExecutiveMetricScope = {
  scope_kind: ExecutiveScopeKind;

  role: ExecutiveMetricRole;

  contractor_id?: string | null;

  covered_pc_org_ids: string[];

  eligible_person_ids?: string[];
  eligible_tech_ids?: string[];

  filters: ExecutiveMetricFilters;
};

export type ExecutiveMetricAggregate = {
  kpi_key: string;

  numerator: number | null;
  denominator: number | null;

  value: number | null;

  direction?: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";

  benchmark?: number | null;
};

export type ExecutiveMetricRow = {
  person_id?: string | null;
  tech_id?: string | null;

  full_name?: string | null;

  pc_org_id?: string | null;
  org_label?: string | null;

  supervisor_person_id?: string | null;
  supervisor_name?: string | null;

  affiliation?: string | null;

  metrics: ExecutiveMetricAggregate[];

  composite?: number | null;
};

export type ExecutiveMetricPayload = {
  generated_at: string;

  scope: ExecutiveMetricScope;

  aggregates: ExecutiveMetricAggregate[];

  rows: ExecutiveMetricRow[];

  available_filters: {
    orgs: Array<{
      pc_org_id: string;
      label: string;
    }>;

    supervisors: Array<{
      person_id: string;
      label: string;
    }>;

    classes: Array<"NSR" | "SMART">;
  };
};