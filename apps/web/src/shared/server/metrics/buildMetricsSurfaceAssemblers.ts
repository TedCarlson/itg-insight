// path: apps/web/src/shared/server/metrics/buildMetricsSurfaceAssemblers.ts

import { loadMetricCompositeRows } from "@/shared/server/metrics/loadMetricCompositeRows.server";
import { loadMetricScoreRows } from "@/shared/server/metrics/loadMetricScoreRows.server";
import { loadMetricWorkMixRows } from "@/shared/server/metrics/loadMetricWorkMixRows.server";
import type {
  MetricsSurfaceTeamCell,
  MetricsSurfaceTeamColumn,
  MetricsSurfaceTeamRow,
} from "@/shared/types/metrics/surfacePayload";

export type DefinitionRow = {
  profile_key: string;
  kpi_key: string;
  label: string;
  customer_label: string;
  raw_label_identifier: string;
  direction: string | null;
  sort_order: number;
  report_order: number | null;
  weight: number | null;
};

export type RubricRow = {
  band_key: string;
  min_value: number | null;
  max_value: number | null;
};

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildMetricDefinitions(args: {
  profileKpiRows: any[];
  profile_key: "NSR" | "SMART";
}): DefinitionRow[] {
  return args.profileKpiRows.map((row: any) => ({
    profile_key: String(row.profile_key ?? args.profile_key),
    kpi_key: String(row.metric_key),
    label: String(row.metric_label ?? row.display_label ?? row.metric_key),
    customer_label: String(
      row.customer_label ??
        row.display_label ??
        row.metric_label ??
        row.metric_key
    ),
    raw_label_identifier: String(
      row.raw_label_identifier ?? row.metric_label ?? row.metric_key
    ),
    direction: toNullableString(row.direction),
    sort_order: toNullableNumber(row.report_order) ?? 999,
    report_order: toNullableNumber(row.report_order),
    weight: toNullableNumber(row.weight),
  }));
}

export function buildRubricByKpi(
  profileKpiRows: any[]
): Map<string, RubricRow[]> {
  const rubricByKpi = new Map<string, RubricRow[]>();

  for (const row of profileKpiRows) {
    const kpiKey = String(row.metric_key ?? "").trim();
    if (!kpiKey) continue;

    const rubricRows = Array.isArray(row.rubric_json) ? row.rubric_json : [];

    rubricByKpi.set(
      kpiKey,
      rubricRows.map((rubric: any) => ({
        band_key: String(rubric.band_key ?? ""),
        min_value: toNullableNumber(rubric.min ?? rubric.min_value),
        max_value: toNullableNumber(rubric.max ?? rubric.max_value),
      }))
    );
  }

  return rubricByKpi;
}

export function buildMetricColumns(
  definitions: DefinitionRow[]
): MetricsSurfaceTeamColumn[] {
  return definitions.map((row) => ({
    kpi_key: row.kpi_key,
    label: row.label,
    report_order: row.report_order,
  }));
}

export function buildAllScoreRows(
  scoreRowsRaw: Awaited<ReturnType<typeof loadMetricScoreRows>>
) {
  return scoreRowsRaw.map((row) => ({
    tech_id: row.tech_id,
    metric_key: row.metric_key,
    metric_value: row.metric_value,
    band_key: row.band_key,
    weighted_points: row.weighted_points,
    numerator: row.numerator,
    denominator: row.denominator,
  }));
}

export function buildWorkMixMap(
  latestWorkMixRows: Awaited<ReturnType<typeof loadMetricWorkMixRows>>
): Map<
  string,
  {
    total: number;
    installs: number;
    tcs: number;
    sros: number;
  }
> {
  const workMixMap = new Map<
    string,
    {
      total: number;
      installs: number;
      tcs: number;
      sros: number;
    }
  >();

  for (const row of latestWorkMixRows) {
    workMixMap.set(row.tech_id, {
      total: row.total,
      installs: row.installs,
      tcs: row.tcs,
      sros: row.sros,
    });
  }

  return workMixMap;
}

export function buildScoreMap(
  latestScoreRows: Awaited<ReturnType<typeof loadMetricScoreRows>>
): Map<string, MetricsSurfaceTeamCell[]> {
  const scoreMap = new Map<string, MetricsSurfaceTeamCell[]>();

  for (const row of latestScoreRows) {
    const list = scoreMap.get(row.tech_id) ?? [];
    list.push({
      metric_key: row.metric_key,
      value: row.metric_value,
      band_key: row.band_key ?? "NO_DATA",
      weighted_points: row.weighted_points,
      numerator: row.numerator,
      denominator: row.denominator,
    });
    scoreMap.set(row.tech_id, list);
  }

  return scoreMap;
}

export function buildTeamRows(args: {
  latestCompositeRows: Awaited<ReturnType<typeof loadMetricCompositeRows>>;
  workMixMap: Map<
    string,
    {
      total: number;
      installs: number;
      tcs: number;
      sros: number;
    }
  >;
  scoreMap: Map<string, MetricsSurfaceTeamCell[]>;
  riskCountByTech: Map<string, number>;
}): MetricsSurfaceTeamRow[] {
  return args.latestCompositeRows.map((row, index) => {
    const workMix = args.workMixMap.get(row.tech_id) ?? null;

    return {
      tech_id: row.tech_id,
      full_name: row.full_name,
      rank: row.rank_in_profile,
      composite_score: row.composite_score,
      metrics: args.scoreMap.get(row.tech_id) ?? [],
      row_key: row.tech_id || `${row.full_name ?? "unknown"}-${index}`,
      work_mix: workMix,
      jobs_display: workMix && workMix.total > 0 ? String(workMix.total) : null,
      risk_count: args.riskCountByTech.get(row.tech_id) ?? 0,
      office_label: row.office_label,
      affiliation_type: row.affiliation_type,
      reports_to_person_id: row.reports_to_person_id,
      co_code: row.co_code,
    };
  });
}