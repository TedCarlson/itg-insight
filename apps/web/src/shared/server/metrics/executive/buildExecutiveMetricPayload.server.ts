// path: apps/web/src/shared/server/metrics/executive/buildExecutiveMetricPayload.server.ts

import { buildMetricsSurfacePayload } from "@/shared/server/metrics/buildMetricsSurfacePayload.server";
import type {
  MetricsSurfacePayload,
  MetricsSurfaceTeamRow,
} from "@/shared/types/metrics/surfacePayload";
import type { ExecutiveMetricScope } from "./types";

type BuildExecutiveMetricPayloadArgs = {
  scope: ExecutiveMetricScope;
  profile_key: "NSR" | "SMART";
  role_label: string;
  rep_full_name?: string | null;
  visibility?: {
    show_jobs?: boolean;
    show_risk?: boolean;
    show_work_mix?: boolean;
    show_parity?: boolean;
  };
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function buildEmptyPayload(args: {
  scope: ExecutiveMetricScope;
  role_label: string;
  rep_full_name?: string | null;
}): MetricsSurfacePayload {
  return {
    header: {
      role_label: args.role_label,
      rep_full_name: args.rep_full_name ?? null,
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
      can_filter_scope: true,
      can_sort_table: true,
    },
    filters: {
      active_range: args.scope.filters.range,
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

function rowKey(row: MetricsSurfaceTeamRow) {
  const value = row as unknown as Record<string, unknown>;

  return [
    clean(value.pc_org_id),
    clean(value.tech_id),
    clean(value.person_id),
    clean(value.full_name),
  ].join("::");
}

function mergeRows(payloads: MetricsSurfacePayload[]) {
  const map = new Map<string, MetricsSurfaceTeamRow>();

  for (const payload of payloads) {
    for (const row of payload.team_table.rows) {
      const key = rowKey(row);
      if (!key.trim()) continue;
      if (!map.has(key)) map.set(key, row);
    }
  }

  return [...map.values()];
}

function techIdsForOrg(args: {
  scope: ExecutiveMetricScope;
  orgId: string;
}) {
  // Current executive adapter passes authorized tech IDs globally.
  // Existing shared metrics builder still expects a per-org tech list.
  // This deliberately keeps the shared builder untouched.
  return args.scope.eligible_tech_ids ?? [];
}

export async function buildExecutiveMetricPayload(
  args: BuildExecutiveMetricPayloadArgs
): Promise<MetricsSurfacePayload> {
  const payloads: MetricsSurfacePayload[] = [];

  for (const orgId of args.scope.covered_pc_org_ids) {
    const scopedTechIds = techIdsForOrg({
      scope: args.scope,
      orgId,
    });

    if (!scopedTechIds.length) continue;

    const payload = await buildMetricsSurfacePayload({
      role_key: args.scope.role,
      profile_key: args.profile_key,
      pc_org_id: orgId,
      range: args.scope.filters.range,
      scoped_tech_ids: scopedTechIds,
      role_label: args.role_label,
      rep_full_name: args.rep_full_name ?? null,
      visibility: {
        show_jobs: args.visibility?.show_jobs ?? false,
        show_risk: args.visibility?.show_risk ?? true,
        show_work_mix: args.visibility?.show_work_mix ?? false,
        show_parity: args.visibility?.show_parity ?? false,
      },
    });

    payloads.push(payload);
  }

  if (!payloads.length) {
    return buildEmptyPayload({
      scope: args.scope,
      role_label: args.role_label,
      rep_full_name: args.rep_full_name,
    });
  }

  const basePayload = payloads[0];
  const mergedRows = mergeRows(payloads);

  return {
    ...basePayload,
    header: {
      ...basePayload.header,
      role_label: args.role_label,
      rep_full_name: args.rep_full_name ?? basePayload.header.rep_full_name,
      scope_headcount: mergedRows.length,
      total_headcount: mergedRows.length,
    },
    permissions: {
      ...basePayload.permissions,
      can_filter_scope: true,
    },
    team_table: {
      ...basePayload.team_table,
      rows: mergedRows,
    },
  };
}

export default buildExecutiveMetricPayload;