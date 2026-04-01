import type {
  WorkforceMetricCell,
  WorkforceRubricRow,
} from "@/shared/kpis/engine/workforceTypes";
import type { RankInputRow } from "@/shared/kpis/contracts/rankTypes";
import { resolveRankContextByTech } from "@/shared/kpis/engine/resolveRankContextByTech";

export type ParityGroupType = "COMPANY" | "CONTRACTOR";

export type ParityMetricCell = WorkforceMetricCell;

export type ParityRow = {
  label: string;
  group_type: ParityGroupType;
  metrics: ParityMetricCell[];
  hc: number;
  rank_value: number | null;
  rank_display: string | null;
};

type KpiDefinition = {
  kpi_key: string;
  label: string;
  sort_order?: number | null;
  weight?: number | null;
  direction?: string | null;
};

type RosterRowLike = {
  team_class?: string | null;
  contractor_name?: string | null;
  metrics: WorkforceMetricCell[];
};

type Params = {
  definitions: KpiDefinition[];
  roster_rows: RosterRowLike[];
  rubricByKpi?: Map<string, WorkforceRubricRow[]>;
  metricFactsByTech?: Map<string, unknown[]>;
  rank_population?: RankInputRow[];
};

type GroupBucket = {
  label: string;
  group_type: ParityGroupType;
  rows: RosterRowLike[];
};

type RankedMetricEntry = {
  row: ParityRow;
  cell: ParityMetricCell;
  definition: KpiDefinition;
};

function normalizeGroupLabel(row: RosterRowLike) {
  const contractor = String(row.contractor_name ?? "").trim();
  if (contractor) {
    return {
      label: contractor,
      group_type: "CONTRACTOR" as const,
    };
  }

  return {
    label: "In-House",
    group_type: "COMPANY" as const,
  };
}

function toParityStableKey(label: string, group_type: ParityGroupType) {
  return `${group_type}::${label}`;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatValue(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(2);
}

function resolveBandKey(
  value: number | null,
  rubric?: WorkforceRubricRow[]
): WorkforceMetricCell["band_key"] {
  if (value == null || !Number.isFinite(value)) return "NO_DATA";
  if (!rubric?.length) return "NO_DATA";

  for (const row of rubric) {
    const minOk = row.min_value == null || value >= row.min_value;
    const maxOk = row.max_value == null || value <= row.max_value;
    if (minOk && maxOk) {
      return row.band_key;
    }
  }

  return "NO_DATA";
}

function normalizeDefinitions(definitions: KpiDefinition[]) {
  return [...definitions].sort((a, b) => {
    const aSort = a.sort_order ?? Number.POSITIVE_INFINITY;
    const bSort = b.sort_order ?? Number.POSITIVE_INFINITY;

    if (aSort !== bSort) return aSort - bSort;
    return a.label.localeCompare(b.label);
  });
}

function normalizeDirection(direction: string | null | undefined) {
  const upper = String(direction ?? "").trim().toUpperCase();

  if (
    upper === "LOWER" ||
    upper === "LOWER_BETTER" ||
    upper === "ASC" ||
    upper === "ASCENDING"
  ) {
    return "LOWER" as const;
  }

  return "HIGHER" as const;
}

function compareValuesForDirection(args: {
  a: number | null;
  b: number | null;
  direction?: string | null;
}) {
  const normalizedDirection = normalizeDirection(args.direction);

  const aValue =
    args.a == null || !Number.isFinite(args.a)
      ? normalizedDirection === "LOWER"
        ? Number.POSITIVE_INFINITY
        : Number.NEGATIVE_INFINITY
      : args.a;

  const bValue =
    args.b == null || !Number.isFinite(args.b)
      ? normalizedDirection === "LOWER"
        ? Number.POSITIVE_INFINITY
        : Number.NEGATIVE_INFINITY
      : args.b;

  if (normalizedDirection === "LOWER") {
    return aValue - bValue;
  }

  return bValue - aValue;
}

function buildParityMetricCell(args: {
  definition: KpiDefinition;
  rows: RosterRowLike[];
  rubric?: WorkforceRubricRow[];
}): ParityMetricCell {
  const values = args.rows
    .map((row) =>
      row.metrics.find((metric) => metric.kpi_key === args.definition.kpi_key)
    )
    .map((metric) => metric?.value)
    .filter((value): value is number => value != null && Number.isFinite(value));

  const avg = average(values);
  const band_key = resolveBandKey(avg, args.rubric);

  return {
    kpi_key: args.definition.kpi_key,
    label: args.definition.label,
    value: avg,
    value_display: formatValue(avg),
    band_key,
    delta_value: null,
    delta_display: null,
    rank_value: null,
    rank_display: null,
    rank_delta_value: null,
    rank_delta_display: null,
    score_value: null,
    score_weight: null,
    score_contribution: null,
  };
}

function compareMetricEntries(a: RankedMetricEntry, b: RankedMetricEntry) {
  const byValue = compareValuesForDirection({
    a: a.cell.value,
    b: b.cell.value,
    direction: a.definition.direction,
  });

  if (byValue !== 0) return byValue;

  return a.row.label.localeCompare(b.row.label);
}

function assignMetricRanks(rows: ParityRow[], definitions: KpiDefinition[]) {
  const orderedDefinitions = normalizeDefinitions(definitions);

  for (const definition of orderedDefinitions) {
    const ranked = rows
      .map((row) => ({
        row,
        cell: row.metrics.find((metric) => metric.kpi_key === definition.kpi_key),
        definition,
      }))
      .filter(
        (entry): entry is RankedMetricEntry =>
          !!entry.cell
      )
      .sort(compareMetricEntries);

    let previousValue: number | null = null;
    let hasPrevious = false;
    let currentRank = 0;

    ranked.forEach((entry, index) => {
      const nextValue = entry.cell.value ?? null;
      const sameAsPrevious =
        hasPrevious &&
        previousValue != null &&
        nextValue != null &&
        previousValue === nextValue;

      if (!sameAsPrevious) {
        currentRank = index + 1;
      }

      entry.cell.rank_value = currentRank;
      entry.cell.rank_display = `#${currentRank}`;
      entry.cell.rank_delta_value = null;
      entry.cell.rank_delta_display = null;

      previousValue = nextValue;
      hasPrevious = true;
    });
  }

  return rows;
}

function applyOverallRanks(rows: ParityRow[], rankPopulation?: RankInputRow[]) {
  if (!rankPopulation?.length) {
    return rows;
  }

  const rankContext = resolveRankContextByTech(rankPopulation, {
    scopes: ["team"],
  });

  const sorted = [...rows].sort((a, b) => {
    const aKey = toParityStableKey(a.label, a.group_type);
    const bKey = toParityStableKey(b.label, b.group_type);

    const aSeat = rankContext.get(aKey)?.team ?? null;
    const bSeat = rankContext.get(bKey)?.team ?? null;

    const aRank = aSeat?.rank ?? Number.POSITIVE_INFINITY;
    const bRank = bSeat?.rank ?? Number.POSITIVE_INFINITY;

    if (aRank !== bRank) return aRank - bRank;

    return a.label.localeCompare(b.label);
  });

  for (const row of sorted) {
    const stableKey = toParityStableKey(row.label, row.group_type);
    const seat = rankContext.get(stableKey)?.team ?? null;

    row.rank_value = seat?.rank ?? null;
    row.rank_display = seat ? `#${seat.rank}` : null;
  }

  return sorted;
}

export function buildParityRows({
  definitions,
  roster_rows,
  rubricByKpi,
  rank_population,
}: Params): ParityRow[] {
  const grouped = new Map<string, GroupBucket>();

  for (const row of roster_rows) {
    const group = normalizeGroupLabel(row);
    const key = toParityStableKey(group.label, group.group_type);

    const existing = grouped.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }

    grouped.set(key, {
      label: group.label,
      group_type: group.group_type,
      rows: [row],
    });
  }

  const orderedDefinitions = normalizeDefinitions(definitions);

  const out: ParityRow[] = [];

  for (const group of grouped.values()) {
    out.push({
      label: group.label,
      group_type: group.group_type,
      hc: group.rows.length,
      rank_value: null,
      rank_display: null,
      metrics: orderedDefinitions.map((definition) =>
        buildParityMetricCell({
          definition,
          rows: group.rows,
          rubric: rubricByKpi?.get(definition.kpi_key),
        })
      ),
    });
  }

  assignMetricRanks(out, orderedDefinitions);

  return applyOverallRanks(out, rank_population);
}