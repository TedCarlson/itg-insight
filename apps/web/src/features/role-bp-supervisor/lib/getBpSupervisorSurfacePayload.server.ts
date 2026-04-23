import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { buildMetricsSurfacePayload } from "@/shared/server/metrics/buildMetricsSurfacePayload.server";
import type {
  MetricsRangeKey,
  MetricsSurfacePayload,
  MetricsSurfaceTeamRow,
} from "@/shared/types/metrics/surfacePayload";

import {
  resolveBpSupervisorScope,
  type BpSupervisorScopeRow,
} from "./resolveBpSupervisorScope.server";

type EnrichedRow = MetricsSurfaceTeamRow & {
  person_id?: string | null;
  office_id?: string | null;
};

function normalizeRange(value?: string | null): MetricsRangeKey {
  const v = String(value ?? "FM").toUpperCase();
  if (v === "PREVIOUS") return "PREVIOUS";
  if (v === "3FM") return "3FM";
  if (v === "12FM") return "12FM";
  return "FM";
}

export async function getBpSupervisorSurfacePayload(args?: {
  profile_key?: string | null;
  range?: string | null;
}): Promise<MetricsSurfacePayload> {
  const scope = await requireSelectedPcOrgServer();
  const range = normalizeRange(args?.range);

  if (!scope.ok) {
    return {
      header: {
        role_label: "BP Supervisor",
        rep_full_name: null,
        org_display: null,
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
        active_range: range,
        available_ranges: ["FM", "PREVIOUS", "3FM", "12FM"],
      },
      visibility: {
        show_jobs: false,
        show_risk: true,
        show_work_mix: false,
        show_parity: false,
      },
      executive_strip: { base: { items: [] }, scope: null, runtime: null },
      executive_kpis: [],
      executive_kpis_scoped: [],
      risk_strip: [],
      team_table: { columns: [], rows: [] },
      overlays: {
        work_mix: null,
        parity_summary: [],
        parity_detail: [],
        jobs_summary: null,
        jobs_detail: [],
      },
    };
  }

  const resolved = await resolveBpSupervisorScope();

  const techIds: string[] = Array.from(
    new Set(
      resolved.scoped_assignments
        .map((r: BpSupervisorScopeRow) =>
          String(r.tech_id ?? "").trim()
        )
        .filter(Boolean)
    )
  );

  const base = await buildMetricsSurfacePayload({
    role_key: "BP_SUPERVISOR",
    profile_key: "NSR",
    pc_org_id: scope.selected_pc_org_id,
    range,
    scoped_tech_ids: techIds,
    role_label: "BP Supervisor",
    rep_full_name: resolved.rep_full_name,
    visibility: {
      show_jobs: false,
      show_risk: true,
      show_work_mix: false,
      show_parity: false,
    },
  });

  const mapByTech = new Map<string, BpSupervisorScopeRow>(
    resolved.scoped_assignments.map((r) => [
      String(r.tech_id ?? "").trim(),
      r,
    ])
  );

  const rows: EnrichedRow[] = base.team_table.rows.map((row) => {
    const techId = String(row.tech_id ?? "").trim();
    const meta = mapByTech.get(techId);

    return {
      ...row,
      person_id: meta?.person_id ?? null,
      office_id: meta?.office_id ?? null,
    };
  });

  return {
    ...base,
    header: {
      ...base.header,
      total_headcount: techIds.length,
      scope_headcount: rows.length,
    },
    team_table: {
      ...base.team_table,
      rows,
    },
  };
}

export default getBpSupervisorSurfacePayload;