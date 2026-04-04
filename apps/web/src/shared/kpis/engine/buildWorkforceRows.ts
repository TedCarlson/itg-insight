// path: src/shared/kpis/engine/buildWorkforceRows.ts

import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";
import type {
  WorkforceKpiConfig,
  WorkforceMetricCell,
  WorkforceRow,
  WorkforceRubricRow,
  WorkforceWorkMix,
} from "./workforceTypes";

type KpiOverrideMap = Map<string, number | null>;
type KpiOverrideRecord = Record<string, KpiOverrideMap>;

type Params = {
  scopedAssignments: any[];
  peopleById: Map<string, any>;
  kpis: (WorkforceKpiConfig & {
    direction?: string | null;
    sort_order?: number | null;
  })[];
  rubricByKpi: Map<string, WorkforceRubricRow[]>;
  orgLabelsById: Map<string, string>;
  workMixByTech: Map<string, WorkforceWorkMix>;
  kpiOverrides?: KpiOverrideRecord | Map<string, KpiOverrideMap>;
  compositeScoresByTech?: Map<string, number | null>;
};

type RankedMetricEntry = {
  row: WorkforceRow;
  metric: WorkforceMetricCell;
  direction?: string | null;
};

function formatValue(value: number | null, kpiKey?: string): string | null {
  if (value == null || !Number.isFinite(value)) return null;

  const normalized = String(kpiKey ?? "").trim().toLowerCase();
  if (normalized.includes("tnps")) {
    return value.toFixed(2);
  }

  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatComposite(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(2);
}

function resolveBand(
  value: number | null,
  rubric?: WorkforceRubricRow[]
): BandKey {
  if (value == null || !rubric?.length) return "NO_DATA" as BandKey;

  for (const row of rubric) {
    const minOk = row.min_value == null || value >= row.min_value;
    const maxOk = row.max_value == null || value <= row.max_value;

    if (minOk && maxOk) {
      return row.band_key;
    }
  }

  return "NO_DATA" as BandKey;
}

function getKpiAliases(kpiKey: string): string[] {
  const key = kpiKey.trim().toLowerCase();

  const aliasMap: Record<string, string[]> = {
    tnps: ["tnps", "tnps_score"],
    tnps_score: ["tnps_score", "tnps"],

    ftr: ["ftr", "ftr_rate"],
    ftr_rate: ["ftr_rate", "ftr"],

    tool_usage: ["tool_usage", "tool_usage_rate", "toolusage", "tu_rate"],
    tool_usage_rate: ["tool_usage_rate", "tool_usage", "toolusage", "tu_rate"],
    toolusage: ["toolusage", "tool_usage", "tool_usage_rate", "tu_rate"],
    tu_rate: ["tu_rate", "tool_usage", "tool_usage_rate", "toolusage"],

    pure_pass: ["pure_pass", "pure_pass_rate", "pht_pure_pass_rate", "purepass"],
    pure_pass_rate: ["pure_pass_rate", "pure_pass", "pht_pure_pass_rate", "purepass"],
    pht_pure_pass_rate: [
      "pht_pure_pass_rate",
      "pure_pass_rate",
      "pure_pass",
      "purepass",
    ],
    purepass: ["purepass", "pure_pass", "pure_pass_rate", "pht_pure_pass_rate"],

    contact_48hr: [
      "contact_48hr",
      "contact_48hr_rate",
      "callback_rate_48hr",
      "48hr_contact",
      "48_hr_contact",
      "callback_48hr",
    ],
    contact_48hr_rate: [
      "contact_48hr_rate",
      "contact_48hr",
      "callback_rate_48hr",
      "48hr_contact",
      "48_hr_contact",
      "callback_48hr",
    ],
    callback_rate_48hr: [
      "callback_rate_48hr",
      "contact_48hr_rate",
      "contact_48hr",
      "48hr_contact",
      "48_hr_contact",
      "callback_48hr",
    ],

    repeat: ["repeat", "repeat_rate"],
    repeat_rate: ["repeat_rate", "repeat"],

    rework: ["rework", "rework_rate"],
    rework_rate: ["rework_rate", "rework"],

    soi: ["soi", "soi_rate"],
    soi_rate: ["soi_rate", "soi"],

    met: ["met", "met_rate"],
    met_rate: ["met_rate", "met"],

    composite: ["composite", "composite_score", "weighted_score", "ws"],
    composite_score: ["composite_score", "composite", "weighted_score", "ws"],
    weighted_score: ["weighted_score", "composite_score", "composite", "ws"],
    ws: ["ws", "weighted_score", "composite_score", "composite"],
  };

  return aliasMap[key] ?? [key];
}

function getOverrideMap(
  kpiOverrides: Params["kpiOverrides"],
  kpiKey: string
): KpiOverrideMap | null {
  if (!kpiOverrides) return null;

  const aliases = getKpiAliases(kpiKey);

  if (kpiOverrides instanceof Map) {
    for (const alias of aliases) {
      const found = kpiOverrides.get(alias);
      if (found) return found;
    }
    return null;
  }

  for (const alias of aliases) {
    const found = kpiOverrides[alias];
    if (found) return found;
  }

  return null;
}

function resolveMetricValue(args: {
  techId: string;
  kpiKey: string;
  kpiOverrides?: Params["kpiOverrides"];
}): number | null {
  const overrideMap = getOverrideMap(args.kpiOverrides, args.kpiKey);
  if (overrideMap?.has(args.techId)) {
    return overrideMap.get(args.techId) ?? null;
  }

  return null;
}

function firstNameOnly(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "Unknown";

  const first = trimmed.split(/\s+/)[0]?.trim();
  return first || "Unknown";
}

function resolveOfficeLabel(args: {
  assignment: any;
  orgLabelsById: Map<string, string>;
}) {
  const { assignment, orgLabelsById } = args;

  const directOffice =
    assignment?.office_name ??
    assignment?.office ??
    assignment?.market_name ??
    assignment?.market ??
    assignment?.branch_name ??
    assignment?.branch ??
    null;

  if (directOffice != null && String(directOffice).trim()) {
    return String(directOffice).trim();
  }

  const pcOrgId = String(assignment?.pc_org_id ?? "").trim();

  if (pcOrgId && orgLabelsById.has(pcOrgId)) {
    return orgLabelsById.get(pcOrgId) ?? pcOrgId;
  }

  return pcOrgId || "Unknown";
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

function assignDenseMetricRanks(
  rows: WorkforceRow[],
  kpis: (WorkforceKpiConfig & {
    direction?: string | null;
    sort_order?: number | null;
  })[]
) {
  const orderedKpis = [...kpis].sort((a, b) => {
    const aSort = a.sort_order ?? Number.POSITIVE_INFINITY;
    const bSort = b.sort_order ?? Number.POSITIVE_INFINITY;
    if (aSort !== bSort) return aSort - bSort;
    return a.label.localeCompare(b.label);
  });

  for (const kpi of orderedKpis) {
    const ranked: RankedMetricEntry[] = rows
      .map((row) => ({
        row,
        metric:
          row.metrics.find((metric) => metric.kpi_key === kpi.kpi_key) ??
          ({
            kpi_key: kpi.kpi_key,
            label: kpi.label,
            value: null,
            value_display: null,
            band_key: "NO_DATA" as BandKey,
            delta_value: null,
            delta_display: null,
            rank_value: null,
            rank_display: null,
            rank_delta_value: null,
            rank_delta_display: null,
            score_value: null,
            score_weight: null,
            score_contribution: null,
          } as WorkforceMetricCell),
        direction: kpi.direction,
      }))
      .filter((entry) => rowHasMetric(entry.row, kpi.kpi_key))
      .sort((a, b) => {
        const byValue = compareValuesForDirection({
          a: a.metric.value,
          b: b.metric.value,
          direction: kpi.direction,
        });

        if (byValue !== 0) return byValue;
        return String(a.row.tech_id ?? "").localeCompare(String(b.row.tech_id ?? ""));
      });

    let previousValue: number | null = null;
    let hasPrevious = false;
    let currentRank = 0;

    ranked.forEach((entry, index) => {
      const nextValue = entry.metric.value ?? null;
      const sameAsPrevious =
        hasPrevious &&
        previousValue != null &&
        nextValue != null &&
        previousValue === nextValue;

      if (!sameAsPrevious) {
        currentRank = index + 1;
      }

      entry.metric.rank_value = currentRank;
      entry.metric.rank_display = `#${currentRank}`;
      entry.metric.rank_delta_value = null;
      entry.metric.rank_delta_display = null;

      previousValue = nextValue;
      hasPrevious = true;
    });
  }

  return rows;
}

function rowHasMetric(row: WorkforceRow, kpiKey: string) {
  return !!row.metrics.find((metric) => metric.kpi_key === kpiKey);
}

export function buildWorkforceRows(params: Params): WorkforceRow[] {
  const {
    scopedAssignments,
    peopleById,
    kpis,
    rubricByKpi,
    orgLabelsById,
    workMixByTech,
    kpiOverrides,
    compositeScoresByTech,
  } = params;

  const rows: WorkforceRow[] = [];

  for (const assignment of scopedAssignments) {
    const techId = String(assignment.tech_id ?? "").trim();
    if (!techId) continue;

    const personId = String(assignment.person_id ?? "").trim();
    const person = peopleById.get(personId);

    const metrics: WorkforceMetricCell[] = [];
    let belowTargetCount = 0;

    for (const kpi of kpis) {
      const value = resolveMetricValue({
        techId,
        kpiKey: kpi.kpi_key,
        kpiOverrides,
      });

      const band = resolveBand(value, rubricByKpi.get(kpi.kpi_key));

      if (band === "MISSES" || band === "NEEDS_IMPROVEMENT") {
        belowTargetCount++;
      }

      metrics.push({
        kpi_key: kpi.kpi_key,
        label: kpi.label,
        value,
        value_display: formatValue(value, kpi.kpi_key),
        band_key: band,
        delta_value: null,
        delta_display: null,
        rank_value: null,
        rank_display: null,
        rank_delta_value: null,
        rank_delta_display: null,
        score_value: null,
        score_weight: null,
        score_contribution: null,
      });
    }

    const officeLabel = resolveOfficeLabel({
      assignment,
      orgLabelsById,
    });

    const resolvedFullName = String(person?.full_name ?? "Unknown");
    const shortName = firstNameOnly(resolvedFullName);
    const fullNameWithTechId = `${shortName} • ${techId}`;

    const work_mix = workMixByTech.get(techId) ?? {
      installs: 0,
      tcs: 0,
      sros: 0,
      total: 0,
    };

    const composite_score = compositeScoresByTech?.get(techId) ?? null;

    rows.push({
      person_id: personId,
      tech_id: techId,
      full_name: fullNameWithTechId,
      context: officeLabel,
      office_name: assignment?.office_name ?? officeLabel,
      leader_assignment_id: assignment?.leader_assignment_id ?? null,
      leader_person_id: assignment?.leader_person_id ?? null,
      leader_name: assignment?.leader_name ?? null,
      leader_title: assignment?.leader_title ?? null,
      contractor_name:
        "contractor_name" in assignment
          ? (assignment.contractor_name ?? null)
          : null,
      composite_score,
      composite_display: formatComposite(composite_score),
      rank: null,
      metrics,
      below_target_count: belowTargetCount,
      work_mix,
    });
  }

  return assignDenseMetricRanks(rows, kpis);
}