// path: apps/web/src/shared/server/metrics/buildMetricsSurfacePayload.server.ts

import { supabaseServer } from "@/shared/data/supabase/server";
import { buildExecutiveKpis } from "@/shared/domain/metrics/buildExecutiveKpis";
import { buildFocusOverlayPayload } from "@/shared/server/metrics/buildFocusOverlayPayload";
import { buildParticipationSignal } from "@/shared/server/metrics/buildParticipationSignal";
import { buildRiskState } from "@/shared/server/metrics/buildRiskState";
import {
  buildPriorityKpiMovements,
  buildRiskMovement,
} from "@/shared/server/metrics/buildRiskMovement";
import {
  buildAllScoreRows,
  buildMetricColumns,
  buildMetricDefinitions,
  buildRubricByKpi,
  buildScoreMap,
  buildTeamRows,
  buildWorkMixMap,
  buildWorkforceIdentityMap,
  type DefinitionRow,
} from "@/shared/server/metrics/buildMetricsSurfaceAssemblers";
import { loadMetricCompositeRows } from "@/shared/server/metrics/loadMetricCompositeRows.server";
import { loadMetricScoreRows } from "@/shared/server/metrics/loadMetricScoreRows.server";
import { loadMetricWorkMixRows } from "@/shared/server/metrics/loadMetricWorkMixRows.server";
import {
  dedupeLatestCompositeRows,
  dedupeLatestScoreRows,
  dedupeLatestWorkMixRows,
} from "@/shared/server/metrics/lib/metricRowDedupers";
import { resolveComparisonBatchIds } from "@/shared/server/metrics/lib/readyBatchResolver";
import { resolveMetricsRangeBatchIds } from "@/shared/server/metrics/resolveMetricsRangeBatchIds.server";
import { resolveMetricsRegionContext } from "@/shared/server/metrics/resolveMetricsRegionContext.server";
import { loadWorkforceSourceRows } from "@/shared/server/workforce/loadWorkforceSourceRows.server";
import type {
  MetricsRangeKey,
  MetricsRiskInsights,
  MetricsSurfacePayload,
} from "@/shared/types/metrics/surfacePayload";
import type {
  MetricsExecutiveRuntimeDefinition,
  MetricsExecutiveRuntimeRubricRow,
  MetricsExecutiveRuntimeScoreRow,
  MetricsScopedExecutiveKpiItem,
  MetricsSurfaceBasePayload,
  MetricsSurfaceScopePayload,
} from "@/shared/types/metrics/executiveStrip";

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

function fallbackAsOfDate() {
  return new Date().toISOString().slice(0, 10);
}

function toRuntimeDefinitions(
  definitions: DefinitionRow[]
): MetricsExecutiveRuntimeDefinition[] {
  return definitions.map((def) => ({
    kpi_key: def.kpi_key,
    label: def.label,
    customer_label: (def as any).customer_label ?? null,
    direction: (def as any).direction ?? null,
  }));
}

function toRuntimeRubricRows(
  rubricByKpi: Map<string, any[]>
): MetricsExecutiveRuntimeRubricRow[] {
  const rows: MetricsExecutiveRuntimeRubricRow[] = [];

  for (const [kpiKey, rubricRows] of rubricByKpi.entries()) {
    for (const row of rubricRows ?? []) {
      rows.push({
        kpi_key: kpiKey,
        band_key: String((row as any).band_key ?? "NO_DATA"),
        min_value:
          typeof (row as any).min_value === "number"
            ? (row as any).min_value
            : null,
        max_value:
          typeof (row as any).max_value === "number"
            ? (row as any).max_value
            : null,
      });
    }
  }

  return rows;
}

function toRuntimeScoreRows(rows: any[]): MetricsExecutiveRuntimeScoreRow[] {
  return rows
    .filter((row) => Boolean(String(row.tech_id ?? "").trim()))
    .map((row) => ({
      tech_id: String(row.tech_id),
      metric_key: String(row.metric_key),
      metric_value:
        typeof row.metric_value === "number" ? row.metric_value : null,
      band_key: row.band_key ?? null,
      weighted_points:
        typeof row.weighted_points === "number" ? row.weighted_points : null,
      numerator: typeof row.numerator === "number" ? row.numerator : null,
      denominator: typeof row.denominator === "number" ? row.denominator : null,
    }));
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

  const comparisonBatchIds = await resolveComparisonBatchIds({
    pc_org_id: args.pc_org_id,
    range: args.range,
  });

  const [
    scoreRowsRaw,
    prevScoreRowsRaw,
    compositeRowsRaw,
    workMixRowsRaw,
    workforceRowsRaw,
  ] = await Promise.all([
    loadMetricScoreRows({
      pc_org_id: args.pc_org_id,
      profile_key: args.profile_key,
      metric_batch_ids: rangeResolution.batch_ids,
    }),
    comparisonBatchIds.length
      ? loadMetricScoreRows({
          pc_org_id: args.pc_org_id,
          profile_key: args.profile_key,
          metric_batch_ids: comparisonBatchIds,
        })
      : [],
    loadMetricCompositeRows({
      pc_org_id: args.pc_org_id,
      profile_key: args.profile_key,
      metric_batch_ids: rangeResolution.batch_ids,
    }),
    loadMetricWorkMixRows({
      pc_org_id: args.pc_org_id,
      metric_batch_ids: rangeResolution.batch_ids,
    }),
    loadWorkforceSourceRows({
      pc_org_id: args.pc_org_id,
      as_of_date: rangeResolution.as_of_date ?? fallbackAsOfDate(),
    }),
  ]);

  const workforceByTechId = buildWorkforceIdentityMap(workforceRowsRaw);

  const definitions: DefinitionRow[] = buildMetricDefinitions({
    profileKpiRows: profileKpiRes.data ?? [],
    profile_key: args.profile_key,
  });

  const rubricByKpi = buildRubricByKpi(profileKpiRes.data ?? []);

  const currentRows = dedupeLatestScoreRows(scoreRowsRaw);
  const previousRows = dedupeLatestScoreRows(prevScoreRowsRaw);

  const allCurrent = buildAllScoreRows(currentRows);
  const allPrevious = buildAllScoreRows(previousRows);

  const scopedCurrent = allCurrent.filter((r) =>
    args.scoped_tech_ids.includes(r.tech_id)
  );
  const scopedPrevious = allPrevious.filter((r) =>
    args.scoped_tech_ids.includes(r.tech_id)
  );

  const baseItems = buildExecutiveKpis({
    definitions,
    supervisorScores: allCurrent,
    orgScores: allPrevious,
    rubricByKpi,
    support: null,
    comparison_scope_code: regionContext.comparison_scope_code,
  });

  const basePayload: MetricsSurfaceBasePayload = {
    items: baseItems,
  };

  let scopePayload: MetricsSurfaceScopePayload | null = null;

  if (args.scoped_tech_ids.length > 0) {
    const scopedTrend = buildExecutiveKpis({
      definitions,
      supervisorScores: scopedCurrent,
      orgScores: scopedPrevious,
      rubricByKpi,
      support: null,
      comparison_scope_code: "SCOPE_TREND",
    });

    const scopedContrast = buildExecutiveKpis({
      definitions,
      supervisorScores: scopedCurrent,
      orgScores: allCurrent,
      rubricByKpi,
      support: null,
      comparison_scope_code: regionContext.comparison_scope_code,
    });

    const scopedItems: MetricsScopedExecutiveKpiItem[] = scopedTrend.map(
      (trendItem) => {
        const contrastItem = scopedContrast.find(
          (c) => c.kpi_key === trendItem.kpi_key
        );

        return {
          kpi_key: trendItem.kpi_key,
          label: trendItem.label,
          value_display: trendItem.value_display,
          band_key: trendItem.band_key,
          band_label: trendItem.band_label,
          support: trendItem.support ?? null,

          trend_scope_code: trendItem.comparison_scope_code,
          trend_comparison_value_display:
            trendItem.comparison_value_display,
          trend_variance_display: trendItem.variance_display,
          trend_state: trendItem.comparison_state,

          contrast_scope_code: regionContext.comparison_scope_code,
          contrast_comparison_value_display:
            contrastItem?.comparison_value_display ?? "—",
          contrast_variance_display: contrastItem?.variance_display ?? null,
          contrast_state: contrastItem?.comparison_state ?? "neutral",
        };
      }
    );

    scopePayload = {
      items: scopedItems,
    };
  }

  const latestCompositeRows = dedupeLatestCompositeRows(
    compositeRowsRaw.filter((row) => Boolean(String(row.tech_id ?? "").trim()))
  );
  const latestWorkMixRows = dedupeLatestWorkMixRows(workMixRowsRaw);

  const workMixMap = buildWorkMixMap(latestWorkMixRows);
  const scoreMap = buildScoreMap(currentRows);

  const riskState = buildRiskState({
    teamRows: latestCompositeRows.map((r) => ({
      tech_id: r.tech_id,
      full_name: r.full_name,
      rank: r.rank_in_profile,
      composite_score: r.composite_score,
    })),
    definitions,
    scoreMap,
    workMixMap,
  });

  const movement = buildRiskMovement({
    definitions,
    currentScoreRows: currentRows,
    previousScoreRows: prevScoreRowsRaw,
    topKpiKey: riskState.insights.top_priority_kpi.kpi_key,
    currentTechIds: riskState.insights.top_priority_kpi.tech_ids,
  });

  const priorityKpis = riskState.insights.priority_kpis ?? [];

  const priorityKpiMovements = buildPriorityKpiMovements({
    definitions,
    currentScoreRows: currentRows,
    previousScoreRows: prevScoreRowsRaw,
    priorityKpis: priorityKpis.map((kpi) => ({
      kpi_key: kpi.kpi_key,
      label: kpi.label,
      miss_count: kpi.miss_count,
      tech_ids: kpi.tech_ids,
    })),
  });

  const participationSignal = buildParticipationSignal({
    definitions,
    currentScoreRows: currentRows,
    previousScoreRows: previousRows,
  });

  const focusOverlayPayload = buildFocusOverlayPayload({
    definitions,
    teamRows: latestCompositeRows.map((r) => ({
      tech_id: r.tech_id,
      full_name: r.full_name,
      rank: r.rank_in_profile,
    })),
    currentScoreRows: currentRows.map((row) => ({
      tech_id: row.tech_id,
      metric_key: row.metric_key,
      metric_value: row.metric_value,
      band_key: row.band_key ?? null,
    })),
    previousScoreRows: previousRows.map((row) => ({
      tech_id: row.tech_id,
      metric_key: row.metric_key,
      metric_value: row.metric_value,
      band_key: row.band_key ?? null,
    })),
    topPriority: {
      kpi_key: riskState.insights.top_priority_kpi.kpi_key,
      new_tech_ids: movement.new_tech_ids,
      persistent_tech_ids: movement.persistent_tech_ids,
      recovered_tech_ids: movement.recovered_tech_ids,
    },
    priorityKpis: priorityKpiMovements.map((kpi) => ({
      kpi_key: kpi.kpi_key,
      label: kpi.label,
      new_tech_ids: kpi.new_tech_ids,
      persistent_tech_ids: kpi.persistent_tech_ids,
      recovered_tech_ids: kpi.recovered_tech_ids,
    })),
    participation: {
      meets_3: {
        tech_ids: riskState.insights.participation.meets_3.tech_ids,
      },
      meets_2: {
        tech_ids: riskState.insights.participation.meets_2.tech_ids,
      },
      meets_1: {
        tech_ids: riskState.insights.participation.meets_1.tech_ids,
      },
      meets_0: {
        tech_ids: riskState.insights.participation.meets_0.tech_ids,
      },
    },
  });

  const riskInsights: MetricsRiskInsights = {
    ...riskState.insights,
    top_priority_kpi: {
      ...riskState.insights.top_priority_kpi,
      new_tech_ids: movement.new_tech_ids,
      persistent_tech_ids: movement.persistent_tech_ids,
      recovered_tech_ids: movement.recovered_tech_ids,
    },
    priority_kpis: priorityKpiMovements,
    top_priority_kpi_overlay: focusOverlayPayload.top_priority_kpi_overlay,
    priority_kpi_overlays: focusOverlayPayload.priority_kpi_overlays,
    participation_overlay: focusOverlayPayload.participation_overlay,
    participation_signal: participationSignal,
  };

  const teamRows = buildTeamRows({
    latestCompositeRows,
    workMixMap,
    scoreMap,
    riskCountByTech: riskState.riskCountByTech,
    workforceByTechId,
  });

  const columns = buildMetricColumns(definitions);

  return {
    header: {
      role_label: args.role_label,
      rep_full_name: args.rep_full_name,
      org_display: regionContext.org_display,
      pc_label: null,
      scope_headcount: args.scoped_tech_ids.length,
      total_headcount: teamRows.length,
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

    executive_strip: {
      base: basePayload,
      scope: scopePayload,
      runtime: {
        definitions: toRuntimeDefinitions(definitions),
        rubric_rows: toRuntimeRubricRows(rubricByKpi),
        current_rows: toRuntimeScoreRows(allCurrent),
        previous_rows: toRuntimeScoreRows(allPrevious),
        comparison_scope_code: regionContext.comparison_scope_code,
      },
    },

    risk_strip: riskState.strip,
    risk_insights: riskInsights,

    team_table: {
      columns,
      rows: teamRows as any,
    },

    overlays: {
      work_mix:
        latestWorkMixRows.length > 0
          ? {
              total: latestWorkMixRows.reduce((sum, row) => sum + row.total, 0),
              installs: latestWorkMixRows.reduce(
                (sum, row) => sum + row.installs,
                0
              ),
              tcs: latestWorkMixRows.reduce((sum, row) => sum + row.tcs, 0),
              sros: latestWorkMixRows.reduce((sum, row) => sum + row.sros, 0),
              install_pct: null,
              tc_pct: null,
              sro_pct: null,
            }
          : null,
      parity_summary: [],
      parity_detail: [],
      jobs_summary: null,
      jobs_detail: [],
    },
  };
}