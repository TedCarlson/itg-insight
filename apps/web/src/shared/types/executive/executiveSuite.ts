import type { MetricsRangeKey } from "@/shared/types/metrics/surfacePayload";

export type ExecutiveConsumerKey = "DIRECTOR";
export type ExecutiveDimensionKey = "workforce" | "metrics" | "route_lock";
export type ExecutiveArtifactStatus = "ready" | "empty" | "degraded" | "not_wired";

export type ExecutiveArtifactCard = {
  key: string;
  label: string;
  value: string;
  helper?: string | null;
  status?: ExecutiveArtifactStatus;
  meta?: Record<string, string | number | boolean | null>;
};

export type ExecutiveDimensionArtifact = {
  key: string;
  title: string;
  description: string;
  status: ExecutiveArtifactStatus;
  cards: ExecutiveArtifactCard[];
  href?: string | null;
};

export type ExecutiveDimensionPayload = {
  dimension: ExecutiveDimensionKey;
  title: string;
  status: ExecutiveArtifactStatus;
  artifacts: ExecutiveDimensionArtifact[];
  notes?: string[];
};

export type ExecutiveSuiteHeader = {
  consumer_key: ExecutiveConsumerKey;
  consumer_label: string;
  pc_org_id: string;
  as_of_date: string;
  range: MetricsRangeKey;
};

export type ExecutiveSuitePayload = {
  header: ExecutiveSuiteHeader;
  dimensions: ExecutiveDimensionPayload[];
};