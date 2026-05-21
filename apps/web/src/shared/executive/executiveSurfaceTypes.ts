// path: apps/web/src/shared/executive/executiveSurfaceTypes.ts

import type { ExecutiveDimensionPayload } from "@/shared/types/executive/executiveSuite";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";
import type { WorkforceRow } from "@/shared/types/workforce/workforce.types";

export type DirectorDimensionKey =
  | "overview"
  | "workforce"
  | "metrics"
  | "route-lock";

export type WorkforceReportsPayload = {
  rows: WorkforceRow[];
  affiliations: WorkforceAffiliationOption[];
  scopedAffiliations: string[];
  regionLabel: string;
  reportMonthLabel: string;
};

export type ExecutiveDimensionCardProps = {
  dimension: ExecutiveDimensionPayload;
};

export type ExecutiveWorkforceCardProps = {
  dimension: ExecutiveDimensionPayload;
  workforceReports?: WorkforceReportsPayload;
};