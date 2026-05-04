// path: apps/web/src/features/role-bp-supervisor/lib/getBpSupervisorSurfacePayload.server.ts

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { buildMetricsSurfacePayload } from "@/shared/server/metrics/buildMetricsSurfacePayload.server";
import type {
  MetricsRangeKey,
  MetricsSurfacePayload,
} from "@/shared/types/metrics/surfacePayload";
import {
  resolveBpSupervisorScope,
} from "./resolveBpSupervisorScope.server";

type BpSupervisorProfileKey = "NSR" | "SMART";

function normalizeProfileKey(
  value: string | null | undefined
): BpSupervisorProfileKey {
  return String(value ?? "NSR").trim().toUpperCase() === "SMART"
    ? "SMART"
    : "NSR";
}

function normalizeRangeKey(value: string | null | undefined): MetricsRangeKey {
  const upper = String(value ?? "FM").trim().toUpperCase();
  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
}

function buildEmptyPayload(range: MetricsRangeKey): MetricsSurfacePayload {
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
    executive_strip: {
      base: { items: [] },
      scope: null,
      runtime: null,
    },
    executive_kpis: [],
    executive_kpis_scoped: [],
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

export async function getBpSupervisorSurfacePayload(args?: {
  profile_key?: string | null;
  range?: string | null;
}): Promise<MetricsSurfacePayload> {
  const scope = await requireSelectedPcOrgServer();
  const profileKey = normalizeProfileKey(args?.profile_key);
  const activeRange = normalizeRangeKey(args?.range);

  if (!scope.ok) {
    return buildEmptyPayload(activeRange);
  }

  const resolvedScope = await resolveBpSupervisorScope();

  // 🔥 ONLY SCOPE CONTROL — NOTHING ELSE
  const scopedTechIds = Array.from(
    new Set(
      resolvedScope.scoped_assignments
        .map((row) => String(row.tech_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const basePayload = await buildMetricsSurfacePayload({
    role_key: "BP_SUPERVISOR",
    profile_key: profileKey,
    pc_org_id: scope.selected_pc_org_id,
    range: activeRange,
    scoped_tech_ids: scopedTechIds,
    role_label: resolvedScope.role_label,
    rep_full_name: resolvedScope.rep_full_name,
    visibility: {
      show_jobs: false,
      show_risk: true,
      show_work_mix: false,
      show_parity: false,
    },
  });

  // 🔥 ONLY ADD rep_person_id FOR CLIENT DEFAULTING
  return {
    ...basePayload,
    header: {
      ...basePayload.header,
      rep_person_id: resolvedScope.rep_person_id ?? null,
    } as MetricsSurfacePayload["header"] & {
      rep_person_id?: string | null;
    },
  };
}

export default getBpSupervisorSurfacePayload;