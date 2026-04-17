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
  type DefinitionRow,
} from "@/shared/server/metrics/buildMetricsSurfaceAssemblers";
import { loadMetricCompositeRows } from "@/shared/server/metrics/loadMetricCompositeRows.server";
import { loadMetricScoreRows } from "@/shared/server/metrics/loadMetricScoreRows.server";
import { resolveMetricsRangeBatchIds } from "@/shared/server/metrics/resolveMetricsRangeBatchIds.server";
import { resolveMetricsRegionContext } from "@/shared/server/metrics/resolveMetricsRegionContext.server";
import { loadMetricWorkMixRows } from "@/shared/server/metrics/loadMetricWorkMixRows.server";
import {
  dedupeLatestCompositeRows,
  dedupeLatestScoreRows,
  dedupeLatestWorkMixRows,
} from "@/shared/server/metrics/lib/metricRowDedupers";
import { resolveComparisonBatchIds } from "@/shared/server/metrics/lib/readyBatchResolver";
import type {
  MetricsRangeKey,
  MetricsRiskInsights,
  MetricsSurfacePayload,
} from "@/shared/types/metrics/surfacePayload";

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

  const profileKpiRows = (profileKpiRes.data ?? []) as any[];

  const definitions: DefinitionRow[] = buildMetricDefinitions({
    profileKpiRows,
    profile_key: args.profile_key,
  });

  const rubricByKpi = buildRubricByKpi(profileKpiRows);
  const columns = buildMetricColumns(definitions);
  const allScoreRows = buildAllScoreRows(scoreRowsRaw);

  const latestScoreRows = dedupeLatestScoreRows(scoreRowsRaw);
  const latestWorkMixRows = dedupeLatestWorkMixRows(workMixRowsRaw);
  const workMixMap = buildWorkMixMap(latestWorkMixRows);
  const scoreMap = buildScoreMap(latestScoreRows);

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

  const comparisonBatchIds = await resolveComparisonBatchIds({
    pc_org_id: args.pc_org_id,
    range: args.range,
  });

  const previousScoreRowsRaw = comparisonBatchIds.length
    ? await loadMetricScoreRows({
        pc_org_id: args.pc_org_id,
        profile_key: args.profile_key,
        metric_batch_ids: comparisonBatchIds,
      })
    : [];

  const previousLatestScoreRows = dedupeLatestScoreRows(previousScoreRowsRaw);

  const movement = buildRiskMovement({
    definitions,
    currentScoreRows: latestScoreRows,
    previousScoreRows: previousScoreRowsRaw,
    topKpiKey: riskState.insights.top_priority_kpi.kpi_key,
    currentTechIds: riskState.insights.top_priority_kpi.tech_ids,
  });

  const priorityKpis = riskState.insights.priority_kpis ?? [];

  const priorityKpiMovements = buildPriorityKpiMovements({
    definitions,
    currentScoreRows: latestScoreRows,
    previousScoreRows: previousScoreRowsRaw,
    priorityKpis: priorityKpis.map((kpi) => ({
      kpi_key: kpi.kpi_key,
      label: kpi.label,
      miss_count: kpi.miss_count,
      tech_ids: kpi.tech_ids,
    })),
  });

  const participationSignal = buildParticipationSignal({
    definitions,
    currentScoreRows: latestScoreRows,
    previousScoreRows: previousLatestScoreRows,
  });

  const focusOverlayPayload = buildFocusOverlayPayload({
    definitions,
    teamRows: latestCompositeRows.map((row) => ({
      tech_id: row.tech_id,
      full_name: row.full_name,
      rank: row.rank_in_profile,
    })),
    currentScoreRows: latestScoreRows.map((row) => ({
      tech_id: row.tech_id,
      metric_key: row.metric_key,
      metric_value: row.metric_value,
      band_key: row.band_key ?? null,
    })),
    previousScoreRows: previousLatestScoreRows.map((row) => ({
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
  });

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
    risk_insights: riskInsights,
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