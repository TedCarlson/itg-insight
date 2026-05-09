// path: apps/web/src/features/role-bp-owner/lib/getBpOwnerSurfacePayload.server.ts

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { buildMetricsSurfacePayload } from "@/shared/server/metrics/buildMetricsSurfacePayload.server";
import type {
  MetricsRangeKey,
  MetricsSurfacePayload,
} from "@/shared/types/metrics/surfacePayload";
import {
  resolveBpOwnerScope,
  type BpOwnerScopeRow,
} from "./resolveBpOwnerScope.server";

type BpOwnerProfileKey = "NSR" | "SMART";

function normalizeProfileKey(
  value: string | null | undefined
): BpOwnerProfileKey {
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
      role_label: "BP Owner",
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

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function buildScopeByTechId(rows: BpOwnerScopeRow[]) {
  const map = new Map<string, BpOwnerScopeRow>();

  for (const row of rows) {
    const techId = clean(row.tech_id);
    if (!techId) continue;
    if (!map.has(techId)) map.set(techId, row);
  }

  return map;
}

export async function getBpOwnerSurfacePayload(args?: {
  profile_key?: string | null;
  range?: string | null;
}): Promise<MetricsSurfacePayload> {
  const scope = await requireSelectedPcOrgServer();
  const profileKey = normalizeProfileKey(args?.profile_key);
  const activeRange = normalizeRangeKey(args?.range);

  if (!scope.ok) {
    return buildEmptyPayload(activeRange);
  }

  const resolvedScope = await resolveBpOwnerScope();

  const scopedTechIds = Array.from(
    new Set(
      resolvedScope.scoped_assignments
        .map((row) => clean(row.tech_id))
        .filter(Boolean)
    )
  );

  const basePayload = await buildMetricsSurfacePayload({
    role_key: "BP_OWNER",
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

  const scopeByTechId = buildScopeByTechId(resolvedScope.scoped_assignments);
  const scopedTechIdSet = new Set(scopedTechIds);

  const enrichedRows = basePayload.team_table.rows
    .filter((row) => scopedTechIdSet.has(clean(row.tech_id)))
    .map((row) => {
      const techId = clean(row.tech_id);
      const scoped = scopeByTechId.get(techId);

      return {
        ...row,
        contractor_name: resolvedScope.contractor_name,
        affiliation_type: "CONTRACTOR",
        co_code: resolvedScope.contractor_name ?? row.co_code ?? null,
        office_id: scoped?.office_id ?? (row as any).office_id ?? null,
      };
    });

  return {
    ...basePayload,
    header: {
      ...basePayload.header,
      role_label: resolvedScope.role_label,
      rep_full_name: resolvedScope.rep_full_name,
      scope_headcount: enrichedRows.length,
      total_headcount: enrichedRows.length,
    },
    team_table: {
      ...basePayload.team_table,
      rows: enrichedRows,
    },
  };
}

export default getBpOwnerSurfacePayload;