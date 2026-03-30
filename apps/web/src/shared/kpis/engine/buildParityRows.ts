import type {
  WorkforceMetricCell,
  WorkforceRubricRow,
} from "@/shared/kpis/engine/workforceTypes";

export type ParityGroupType = "COMPANY" | "CONTRACTOR";

export type ParityMetricCell = WorkforceMetricCell;

export type ParityRow = {
  label: string;
  group_type: ParityGroupType;
  metrics: ParityMetricCell[];
  hc: number;
};

type KpiDefinition = {
  kpi_key: string;
  label: string;
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

function buildParityMetricCell(args: {
  kpi_key: string;
  label: string;
  rows: RosterRowLike[];
  rubric?: WorkforceRubricRow[];
}): ParityMetricCell {
  const values = args.rows
    .map((row) => row.metrics.find((metric) => metric.kpi_key === args.kpi_key))
    .map((metric) => metric?.value)
    .filter((value): value is number => value != null && Number.isFinite(value));

  const avg = average(values);

  return {
    kpi_key: args.kpi_key,
    label: args.label,
    value: avg,
    value_display: formatValue(avg),
    band_key: resolveBandKey(avg, args.rubric),
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

export function buildParityRows({
  definitions,
  roster_rows,
  rubricByKpi,
}: Params): ParityRow[] {
  const grouped = new Map<
    string,
    {
      label: string;
      group_type: ParityGroupType;
      rows: RosterRowLike[];
    }
  >();

  for (const row of roster_rows) {
    const group = normalizeGroupLabel(row);
    const key = `${group.group_type}::${group.label}`;

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

  const out: ParityRow[] = [];

  for (const group of grouped.values()) {
    out.push({
      label: group.label,
      group_type: group.group_type,
      hc: group.rows.length,
      metrics: definitions.map((definition) =>
        buildParityMetricCell({
          kpi_key: definition.kpi_key,
          label: definition.label,
          rows: group.rows,
          rubric: rubricByKpi?.get(definition.kpi_key),
        })
      ),
    });
  }

  return out.sort((a, b) => {
    if (a.group_type !== b.group_type) {
      return a.group_type === "COMPANY" ? -1 : 1;
    }

    if (a.hc !== b.hc) {
      return b.hc - a.hc;
    }

    return a.label.localeCompare(b.label);
  });
}