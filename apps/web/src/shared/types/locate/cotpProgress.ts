export type CotpRange =
  | "CURRENT_WEEK"
  | "ALL_HISTORY";

export type CotpSnapshotColumn = {
  key: string;
  label: string;
  as_of_label?: string;
  week_ending_label: string;
  week_ending_date: string;
  source_as_of_at: string | null;
};

export type CotpStateRow = {
  state: string;
  values: Record<string, number | null>;
  latest_value: number | null;
  trend_value: number | null;
};

export type CotpProgressPayload = {
  range: CotpRange;
  columns: CotpSnapshotColumn[];
  rows: CotpStateRow[];
};
