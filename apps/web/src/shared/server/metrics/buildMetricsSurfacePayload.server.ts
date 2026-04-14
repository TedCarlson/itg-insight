// path: apps/web/src/shared/server/metrics/buildMetricsSurfacePayload.server.ts

import { supabaseServer } from "@/shared/data/supabase/server";
import { buildExecutiveKpis } from "@/shared/domain/metrics/buildExecutiveKpis";
import { loadMetricCompositeRows } from "@/shared/server/metrics/loadMetricCompositeRows.server";
import { loadMetricScoreRows } from "@/shared/server/metrics/loadMetricScoreRows.server";
import { resolveMetricsRangeBatchIds } from "@/shared/server/metrics/resolveMetricsRangeBatchIds.server";
import { resolveMetricsRegionContext } from "@/shared/server/metrics/resolveMetricsRegionContext.server";
import { loadMetricWorkMixRows } from "@/shared/server/metrics/loadMetricWorkMixRows.server";
import type {
  MetricsRangeKey,
  MetricsRiskInsightPerformer,
  MetricsRiskInsights,
  MetricsRiskStripItem,
  MetricsSurfacePayload,
  MetricsSurfaceTeamCell,
  MetricsSurfaceTeamColumn,
  MetricsSurfaceTeamRow,
} from "@/shared/types/metrics/surfacePayload";

type DefinitionRow = {
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

type RubricRow = {
  band_key: string;
  min_value: number | null;
  max_value: number | null;
};

export type BuildMetricsSurfacePayloadArgs = {
  role_key: string;
  profile_key: "NSR" | "SMART";
  pc_org_id: string;
  range: MetricsRangeKey;
  scoped_tech_ids: string[];
  role_label: string | null;
  rep_full_name: string | null;
  visibility?: {
    show_jobs?: boolean;
    show_risk?: boolean;
    show_work_mix?: boolean;
    show_parity?: boolean;
  };
};

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildEmptyPayload(args: {
  range: MetricsRangeKey;
  role_label: string | null;
  rep_full_name: string | null;
  org_display?: string | null;
}): MetricsSurfacePayload {
  return {
    header: {
      role_label: args.role_label,
      rep_full_name: args.rep_full_name,
      org_display: args.org_display ?? null,
      pc_label: null,
      scope_headcount: 0,
      total_headcount: 0,
      as_of_date: null,
    },
    permissions: {
      can_view_exec_strip: true,
      can_view_risk_strip: true,
      can_view_team_table: true,
      can_view_work_mix: true,
      can_view_parity: true,
      can_view_kpi_rubric: true,
      can_view_tech_drill: true,
      can_view_org_drill: true,
      can_filter_range: true,
      can_filter_scope: false,
      can_sort_table: true,
    },
    filters: {
      active_range: args.range,
      available_ranges: ["FM", "PREVIOUS", "3FM", "12FM"],
    },
    visibility: {
      show_jobs: false,
      show_risk: true,
      show_work_mix: false,
      show_parity: false,
    },
    executive_kpis: [],
    risk_strip: [],
    team_table: {
      columns: [],
      rows: [],
    },
    overlays: {
      work_mix: null,
      parity_summary: [],
      parity_detail: [],
      jobs_summary: null,
      jobs_detail: [],
    },
  };
}

function metricDateSortValue(value: string | null): number {
  if (!value) return 0;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : 0;
}

function dedupeLatestCompositeRows(
  rows: Awaited<ReturnType<typeof loadMetricCompositeRows>>
): Awaited<ReturnType<typeof loadMetricCompositeRows>> {
  const sorted = [...rows].sort((a, b) => {
    const dateDiff =
      metricDateSortValue(b.metric_date) - metricDateSortValue(a.metric_date);
    if (dateDiff !== 0) return dateDiff;
    return a.tech_id.localeCompare(b.tech_id);
  });

  const seen = new Set<string>();
  const out: typeof rows = [];

  for (const row of sorted) {
    const techId = String(row.tech_id ?? "").trim();
    if (!techId || seen.has(techId)) continue;
    seen.add(techId);
    out.push(row);
  }

  return out.sort((a, b) => {
    const rankA =
      typeof a.rank_in_profile === "number" ? a.rank_in_profile : 999999;
    const rankB =
      typeof b.rank_in_profile === "number" ? b.rank_in_profile : 999999;
    if (rankA !== rankB) return rankA - rankB;
    return String(a.full_name ?? "").localeCompare(String(b.full_name ?? ""));
  });
}

function dedupeLatestScoreRows(
  rows: Awaited<ReturnType<typeof loadMetricScoreRows>>
): Awaited<ReturnType<typeof loadMetricScoreRows>> {
  const sorted = [...rows].sort((a, b) => {
    const dateDiff =
      metricDateSortValue(b.metric_date) - metricDateSortValue(a.metric_date);
    if (dateDiff !== 0) return dateDiff;

    const techDiff = a.tech_id.localeCompare(b.tech_id);
    if (techDiff !== 0) return techDiff;

    return a.metric_key.localeCompare(b.metric_key);
  });

  const seen = new Set<string>();
  const out: typeof rows = [];

  for (const row of sorted) {
    const key = `${row.tech_id}::${row.metric_key}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

function dedupeLatestWorkMixRows(
  rows: Awaited<ReturnType<typeof loadMetricWorkMixRows>>
): Awaited<ReturnType<typeof loadMetricWorkMixRows>> {
  const sorted = [...rows].sort((a, b) => {
    const dateDiff =
      metricDateSortValue(b.metric_date) - metricDateSortValue(a.metric_date);
    if (dateDiff !== 0) return dateDiff;
    return a.tech_id.localeCompare(b.tech_id);
  });

  const seen = new Set<string>();
  const out: typeof rows = [];

  for (const row of sorted) {
    const techId = String(row.tech_id ?? "").trim();
    if (!techId || seen.has(techId)) continue;
    seen.add(techId);
    out.push(row);
  }

  return out;
}

function isRiskBand(bandKey: string | null | undefined) {
  return bandKey === "NEEDS_IMPROVEMENT" || bandKey === "MISSES";
}

// REPLACE THIS FUNCTION ONLY inside:
function buildRiskState(args: {
  teamRows: Array<{
    tech_id: string;
    full_name: string | null;
    rank: number | null;
    composite_score: number | null;
  }>;
  definitions: DefinitionRow[];
  scoreMap: Map<string, MetricsSurfaceTeamCell[]>;
  workMixMap: Map<
    string,
    {
      total: number;
      installs: number;
      tcs: number;
      sros: number;
    }
  >;
}) {
  const riskCountByTech = new Map<string, number>();

  function isFail(band: string | null | undefined) {
    return band === "NEEDS_IMPROVEMENT" || band === "MISSES";
  }

  function isPass(band: string | null | undefined) {
    return band === "MEETS" || band === "EXCEEDS";
  }

  function isMiss(band: string | null | undefined) {
    return band === "MISSES";
  }

  const scopedDefinitions = [...args.definitions]
    .filter((def) => (def.weight ?? 0) > 0)
    .sort((a, b) => {
      const ao = a.report_order ?? 999;
      const bo = b.report_order ?? 999;
      if (ao !== bo) return ao - bo;
      return a.kpi_key.localeCompare(b.kpi_key);
    })
    .slice(0, 3);

  const scopedKpiKeys = new Set(scopedDefinitions.map((def) => def.kpi_key));

  const labelByKpi = new Map(
    args.definitions.map((def) => [def.kpi_key, def.customer_label || def.label])
  );

  const techFailMap = new Map<string, string[]>();
  const techScopedPassMap = new Map<string, string[]>();
  const techScopedFailMap = new Map<string, string[]>();
  const kpiMissMap = new Map<string, string[]>();

  for (const row of args.teamRows) {
    const techId = row.tech_id;
    const metrics = args.scoreMap.get(techId) ?? [];

    let totalRiskCount = 0;
    const failedKpis: string[] = [];
    const scopedPassedKpis: string[] = [];
    const scopedFailedKpis: string[] = [];

    for (const metric of metrics) {
      if (isFail(metric.band_key)) {
        totalRiskCount += 1;
        failedKpis.push(metric.metric_key);
      }

      if (!scopedKpiKeys.has(metric.metric_key)) continue;

      if (isPass(metric.band_key)) {
        scopedPassedKpis.push(metric.metric_key);
      } else if (isFail(metric.band_key)) {
        scopedFailedKpis.push(metric.metric_key);
      }

      if (isMiss(metric.band_key)) {
        const list = kpiMissMap.get(metric.metric_key) ?? [];
        list.push(techId);
        kpiMissMap.set(metric.metric_key, list);
      }
    }

    techFailMap.set(techId, failedKpis);
    techScopedPassMap.set(techId, scopedPassedKpis);
    techScopedFailMap.set(techId, scopedFailedKpis);
    riskCountByTech.set(techId, totalRiskCount);
  }

  let topKpi: string | null = null;
  let topKpiCount = 0;

  for (const [kpiKey, techIds] of kpiMissMap.entries()) {
    if (!scopedKpiKeys.has(kpiKey)) continue;
    if (techIds.length > topKpiCount) {
      topKpi = kpiKey;
      topKpiCount = techIds.length;
    }
  }

  let meets3 = 0;
  let meets2 = 0;
  let meets1 = 0;
  let meets0 = 0;

  const meets3TechIds: string[] = [];
  const meets2TechIds: string[] = [];
  const meets1TechIds: string[] = [];
  const meets0TechIds: string[] = [];

  for (const row of args.teamRows) {
    const passCount = techScopedPassMap.get(row.tech_id)?.length ?? 0;

    if (passCount >= 3) {
      meets3 += 1;
      meets3TechIds.push(row.tech_id);
    } else if (passCount === 2) {
      meets2 += 1;
      meets2TechIds.push(row.tech_id);
    } else if (passCount === 1) {
      meets1 += 1;
      meets1TechIds.push(row.tech_id);
    } else {
      meets0 += 1;
      meets0TechIds.push(row.tech_id);
    }
  }

  const sortedByRiskThenComposite = [...args.teamRows].sort((a, b) => {
    const riskA = riskCountByTech.get(a.tech_id) ?? 0;
    const riskB = riskCountByTech.get(b.tech_id) ?? 0;
    if (riskA !== riskB) return riskA - riskB;

    const compA =
      typeof a.composite_score === "number" && Number.isFinite(a.composite_score)
        ? a.composite_score
        : -1;
    const compB =
      typeof b.composite_score === "number" && Number.isFinite(b.composite_score)
        ? b.composite_score
        : -1;
    return compB - compA;
  });

  function toPerformer(row: {
    tech_id: string;
    full_name: string | null;
    rank: number | null;
    composite_score: number | null;
  }): MetricsRiskInsightPerformer {
    const failed = techScopedFailMap.get(row.tech_id) ?? [];
    const primaryKpiKey = failed[0] ?? null;

    return {
      tech_id: row.tech_id,
      full_name: row.full_name,
      rank: row.rank,
      composite_score: row.composite_score,
      risk_count: riskCountByTech.get(row.tech_id) ?? 0,
      streak_count: null,
      primary_kpi_key: primaryKpiKey,
      primary_kpi_label: primaryKpiKey
        ? labelByKpi.get(primaryKpiKey) ?? primaryKpiKey
        : null,
    };
  }

  const topPerformers = sortedByRiskThenComposite.slice(0, 3).map(toPerformer);
  const bottomPerformers = [...sortedByRiskThenComposite]
    .reverse()
    .slice(0, 5)
    .map(toPerformer);

  const strip: MetricsRiskStripItem[] = [
    {
      key: "top_kpi",
      title: "Top Risk KPI",
      value: topKpi ? labelByKpi.get(topKpi) ?? topKpi : "—",
      note: `${topKpiCount} techs`,
    },
    {
      key: "participation",
      title: "Participation",
      value: `${meets3}/${args.teamRows.length}`,
      note: "Meets all KPIs",
    },
    {
      key: "top",
      title: "Top Performers",
      value: String(topPerformers.length),
      note: "Lowest risk",
    },
    {
      key: "bottom",
      title: "Needs Attention",
      value: String(bottomPerformers.length),
      note: "Highest risk",
    },
  ];

  const insights: MetricsRiskInsights = {
    top_priority_kpi: {
      kpi_key: topKpi,
      label: topKpi ? labelByKpi.get(topKpi) ?? topKpi : null,
      miss_count: topKpiCount,
      tech_ids: topKpi ? kpiMissMap.get(topKpi) ?? [] : [],
      new_tech_ids: [],
      persistent_tech_ids: [],
      recovered_tech_ids: [],
    },
    participation: {
      meets_3: {
        count: meets3,
        tech_ids: meets3TechIds,
      },
      meets_2: {
        count: meets2,
        tech_ids: meets2TechIds,
      },
      meets_1: {
        count: meets1,
        tech_ids: meets1TechIds,
      },
      meets_0: {
        count: meets0,
        tech_ids: meets0TechIds,
      },
    },
    top_performers: topPerformers,
    bottom_performers: bottomPerformers,
  };

  return {
    riskCountByTech,
    strip,
    insights,
  };
}

export async function buildMetricsSurfacePayload(
  args: BuildMetricsSurfacePayloadArgs
): Promise<MetricsSurfacePayload> {
  const sb = await supabaseServer();

  const [regionContext, rangeResolution, profileKpiRes] = await Promise.all([
    resolveMetricsRegionContext({ pc_org_id: args.pc_org_id }),
    resolveMetricsRangeBatchIds({
      pc_org_id: args.pc_org_id,
      range: args.range,
    }),
    sb
      .from("metric_profile_kpis_v")
      .select(
        "profile_key, metric_key, metric_label, display_label, report_order, direction, customer_label, raw_label_identifier, rubric_json, weight"
      )
      .eq("profile_key", args.profile_key)
      .eq("profile_is_active", true)
      .eq("metric_is_active", true)
      .eq("is_enabled", true)
      .order("report_order", { ascending: true })
      .order("metric_key", { ascending: true }),
  ]);

  if (profileKpiRes.error) {
    throw new Error(profileKpiRes.error.message);
  }

  if (!rangeResolution.batch_ids.length) {
    const empty = buildEmptyPayload({
      range: args.range,
      role_label: args.role_label,
      rep_full_name: args.rep_full_name,
      org_display: regionContext.org_display,
    });

    return {
      ...empty,
      header: {
        ...empty.header,
        as_of_date: rangeResolution.as_of_date,
      },
      visibility: {
        show_jobs: args.visibility?.show_jobs ?? false,
        show_risk: args.visibility?.show_risk ?? true,
        show_work_mix: args.visibility?.show_work_mix ?? false,
        show_parity: args.visibility?.show_parity ?? false,
      },
    };
  }

  const [scoreRowsRaw, compositeRowsRaw, workMixRowsRaw] = await Promise.all([
    loadMetricScoreRows({
      pc_org_id: args.pc_org_id,
      profile_key: args.profile_key,
      metric_batch_ids: rangeResolution.batch_ids,
    }),
    loadMetricCompositeRows({
      pc_org_id: args.pc_org_id,
      profile_key: args.profile_key,
      metric_batch_ids: rangeResolution.batch_ids,
    }),
    loadMetricWorkMixRows({
      pc_org_id: args.pc_org_id,
      metric_batch_ids: rangeResolution.batch_ids,
    }),
  ]);

  const definitions: DefinitionRow[] = ((profileKpiRes.data ?? []) as any[]).map(
    (row: any) => ({
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
    })
  );

  const rubricByKpi = new Map<string, RubricRow[]>();
  for (const row of (profileKpiRes.data ?? []) as any[]) {
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

  const columns: MetricsSurfaceTeamColumn[] = definitions.map((row) => ({
    kpi_key: row.kpi_key,
    label: row.label,
    report_order: row.report_order,
  }));

  const allScoreRows = scoreRowsRaw.map((row) => ({
    tech_id: row.tech_id,
    metric_key: row.metric_key,
    metric_value: row.metric_value,
    band_key: row.band_key,
    weighted_points: row.weighted_points,
    numerator: row.numerator,
    denominator: row.denominator,
  }));

  const latestScoreRows = dedupeLatestScoreRows(scoreRowsRaw);
  const latestWorkMixRows = dedupeLatestWorkMixRows(workMixRowsRaw);

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

  const latestCompositeRows = dedupeLatestCompositeRows(
    compositeRowsRaw.filter((row) => Boolean(String(row.tech_id ?? "").trim()))
  );

  const riskState = buildRiskState({
    teamRows: latestCompositeRows.map((row) => ({
      tech_id: row.tech_id,
      full_name: row.full_name,
      rank: row.rank_in_profile,
      composite_score: row.composite_score,
    })),
    definitions,
    scoreMap,
    workMixMap,
  });

  const teamRows: MetricsSurfaceTeamRow[] = latestCompositeRows.map(
    (row, index) => {
      const workMix = workMixMap.get(row.tech_id) ?? null;

      return {
        tech_id: row.tech_id,
        full_name: row.full_name,
        rank: row.rank_in_profile,
        composite_score: row.composite_score,
        metrics: scoreMap.get(row.tech_id) ?? [],
        row_key: row.tech_id || `${row.full_name ?? "unknown"}-${index}`,
        work_mix: workMix,
        jobs_display:
          workMix && workMix.total > 0 ? String(workMix.total) : null,
        risk_count: riskState.riskCountByTech.get(row.tech_id) ?? 0,
      };
    }
  );

  const scopedScores = allScoreRows.filter((row) =>
    args.scoped_tech_ids.includes(row.tech_id)
  );

  const executiveKpis =
    args.scoped_tech_ids.length > 0
      ? buildExecutiveKpis({
        definitions,
        supervisorScores: scopedScores,
        orgScores: allScoreRows,
        rubricByKpi,
        support: null,
        comparison_scope_code: regionContext.comparison_scope_code,
      })
      : [];

  const totalJobs = latestWorkMixRows.reduce((sum, row) => sum + row.total, 0);
  const totalInstalls = latestWorkMixRows.reduce(
    (sum, row) => sum + row.installs,
    0
  );
  const totalTcs = latestWorkMixRows.reduce((sum, row) => sum + row.tcs, 0);
  const totalSros = latestWorkMixRows.reduce((sum, row) => sum + row.sros, 0);

  return {
    header: {
      role_label: args.role_label,
      rep_full_name: args.rep_full_name,
      org_display: regionContext.org_display,
      pc_label: null,
      scope_headcount: teamRows.length,
      total_headcount: args.scoped_tech_ids.length,
      as_of_date: rangeResolution.as_of_date,
    },
    permissions: {
      can_view_exec_strip: true,
      can_view_risk_strip: true,
      can_view_team_table: true,
      can_view_work_mix: true,
      can_view_parity: true,
      can_view_kpi_rubric: true,
      can_view_tech_drill: true,
      can_view_org_drill: true,
      can_filter_range: true,
      can_filter_scope: false,
      can_sort_table: true,
    },
    filters: {
      active_range: rangeResolution.active_range,
      available_ranges: ["FM", "PREVIOUS", "3FM", "12FM"],
    },
    visibility: {
      show_jobs: args.visibility?.show_jobs ?? false,
      show_risk: args.visibility?.show_risk ?? true,
      show_work_mix: args.visibility?.show_work_mix ?? false,
      show_parity: args.visibility?.show_parity ?? false,
    },
    executive_kpis: executiveKpis,
    risk_strip: riskState.strip,
    risk_insights: riskState.insights,
    team_table: {
      columns,
      rows: teamRows,
    },
    overlays: {
      work_mix:
        totalJobs > 0
          ? {
            total: totalJobs,
            installs: totalInstalls,
            tcs: totalTcs,
            sros: totalSros,
            install_pct: totalJobs > 0 ? totalInstalls / totalJobs : null,
            tc_pct: totalJobs > 0 ? totalTcs / totalJobs : null,
            sro_pct: totalJobs > 0 ? totalSros / totalJobs : null,
          }
          : null,
      parity_summary: [],
      parity_detail: [],
      jobs_summary:
        totalJobs > 0
          ? {
            total_jobs: totalJobs,
            installs: totalInstalls,
            tcs: totalTcs,
            sros: totalSros,
          }
          : null,
      jobs_detail:
        totalJobs > 0
          ? [
            { label: "Installs", value: totalInstalls },
            { label: "TCs", value: totalTcs },
            { label: "SROs", value: totalSros },
          ]
          : [],
    },
  };
}