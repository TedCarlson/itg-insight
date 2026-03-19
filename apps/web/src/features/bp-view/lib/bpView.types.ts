import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";

export type BpViewHeaderData = {
  role_label: string;
  scope_label: string;
  org_label: string;
  org_count: number;
  range_label: "FM" | "3FM" | "12FM";
  as_of_date: string;
};

export type BpViewKpiItem = {
  kpi_key: string;
  label: string;
  value: number | null;
  value_display: string | null;
  band_key: BandKey;
  band_label: string;
  support: string | null;
};

export type BpViewRosterMetricCell = {
  kpi_key: string;
  label: string;
  value: number | null;
  value_display: string | null;
  band_key: BandKey;
};

export type BpViewRosterRow = {
  person_id: string;
  tech_id: string;
  full_name: string;
  context: string;
  metrics: BpViewRosterMetricCell[];
  below_target_count: number;
};

export type BpViewRiskItem = {
  title: string;
  value: string;
  note: string;
};

export type BpViewPayload = {
  header: BpViewHeaderData;
  kpi_strip: BpViewKpiItem[];
  risk_strip: BpViewRiskItem[];
  roster_columns: Array<{ kpi_key: string; label: string }>;
  roster_rows: BpViewRosterRow[];
};