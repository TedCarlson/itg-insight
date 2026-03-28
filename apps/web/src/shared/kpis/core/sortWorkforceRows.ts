type WorkforceMetricCell = {
  kpi_key: string;
  value: number | null;
};

type WorkforceRowLike = {
  full_name: string;
  below_target_count: number | null;
  work_mix?: {
    total?: number | null;
  } | null;
  metrics: WorkforceMetricCell[];
};

type WorkforceRosterColumn = {
  kpi_key: string;
  label: string;
};

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function jobsForRow<Row extends WorkforceRowLike>(row: Row) {
  return safeNumber(row.work_mix?.total) ?? 0;
}

function metricValueForKey<Row extends WorkforceRowLike>(row: Row, kpiKey: string) {
  const metric = row.metrics.find((item) => item.kpi_key === kpiKey);
  return safeNumber(metric?.value);
}

function primaryKpiAggregate<Row extends WorkforceRowLike>(
  row: Row,
  rosterColumns: WorkforceRosterColumn[]
) {
  const primaryKeys = rosterColumns.slice(0, 3).map((col) => col.kpi_key);

  const values = primaryKeys
    .map((kpiKey) => metricValueForKey(row, kpiKey))
    .filter((value): value is number => value != null);

  if (!values.length) return -1;

  return values.reduce((sum, value) => sum + value, 0);
}

function fullNameForSort<Row extends WorkforceRowLike>(row: Row) {
  return String(row.full_name ?? "").trim().toLowerCase();
}

export function sortWorkforceRows<Row extends WorkforceRowLike>(
  rows: Row[],
  rosterColumns: WorkforceRosterColumn[]
): Row[] {
  return [...rows].sort((a, b) => {
    const aJobs = jobsForRow(a);
    const bJobs = jobsForRow(b);

    const aHasJobs = aJobs > 0 ? 1 : 0;
    const bHasJobs = bJobs > 0 ? 1 : 0;

    // 1) must have jobs or sink to bottom
    if (aHasJobs !== bHasJobs) return bHasJobs - aHasJobs;

    // 2) crude fallback rank = first 3 KPI total, high to low
    const aPrimary = primaryKpiAggregate(a, rosterColumns);
    const bPrimary = primaryKpiAggregate(b, rosterColumns);

    if (aPrimary !== bPrimary) return bPrimary - aPrimary;

    // 3) stable fallback
    return fullNameForSort(a).localeCompare(fullNameForSort(b));
  });
}