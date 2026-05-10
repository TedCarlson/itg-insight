// path: apps/web/src/features/role-bp-owner/lib/getBpOwnerExecutiveMetricsPayload.server.ts

import { buildMetricsSurfacePayload } from "@/shared/server/metrics/buildMetricsSurfacePayload.server";
import buildExecutiveAggregateStrip from "@/shared/server/metrics/executive/buildExecutiveAggregateStrip.server";
import type {
  MetricsRangeKey,
  MetricsSurfacePayload,
  MetricsSurfaceTeamRow,
} from "@/shared/types/metrics/surfacePayload";
import { resolveBpOwnerScope } from "./resolveBpOwnerScope.server";

type BpOwnerProfileKey = "NSR" | "SMART";

type Args = {
  profile_key: BpOwnerProfileKey;
  range: MetricsRangeKey;
};

type BpOwnerOrgKpiRow = {
  pc_org_id: string;
  org_label: string;
  items: NonNullable<MetricsSurfacePayload["executive_strip"]>["base"]["items"];
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const parsed = Number(String(value ?? "").replace(/[%,$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildEmptyPayload(args: {
  range: MetricsRangeKey;
  role_label?: string | null;
  rep_full_name?: string | null;
}): MetricsSurfacePayload {
  return {
    header: {
      role_label: args.role_label ?? "BP Owner",
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
      active_range: args.range,
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

function groupTechIdsByOrg(
  assignments: Array<{
    pc_org_id: string | null;
    tech_id: string | null;
  }>
) {
  const map = new Map<string, Set<string>>();

  for (const row of assignments) {
    const orgId = clean(row.pc_org_id);
    const techId = clean(row.tech_id);

    if (!orgId || !techId) continue;

    const set = map.get(orgId) ?? new Set<string>();
    set.add(techId);
    map.set(orgId, set);
  }

  return map;
}

function getRowValue(row: MetricsSurfaceTeamRow, key: string) {
  return clean((row as unknown as Record<string, unknown>)[key]);
}

function getRowRaw(row: MetricsSurfaceTeamRow, key: string) {
  return (row as unknown as Record<string, unknown>)[key];
}

function rowTechId(row: MetricsSurfaceTeamRow) {
  return getRowValue(row, "tech_id");
}

function rowOrgId(row: MetricsSurfaceTeamRow) {
  return getRowValue(row, "pc_org_id");
}

function rowKey(row: MetricsSurfaceTeamRow) {
  return [
    rowOrgId(row),
    rowTechId(row),
    getRowValue(row, "person_id"),
    getRowValue(row, "full_name"),
  ].join("::");
}

function compositeValue(row: MetricsSurfaceTeamRow) {
  return numeric(getRowRaw(row, "composite_score")) ?? 0;
}

function sourceRankValue(row: MetricsSurfaceTeamRow) {
  return (
    numeric(getRowRaw(row, "rank")) ??
    numeric(getRowRaw(row, "composite_rank")) ??
    null
  );
}

function sourceOrgLabel(row: MetricsSurfaceTeamRow) {
  return (
    getRowValue(row, "source_org_label") ||
    getRowValue(row, "org_label") ||
    getRowValue(row, "pc_label") ||
    getRowValue(row, "office") ||
    getRowValue(row, "office_label") ||
    getRowValue(row, "pc_org_id")
  );
}

function orgLabelFromPayload(payload: MetricsSurfacePayload, fallbackOrgId: string) {
  return (
    clean(payload.header.pc_label) ||
    clean(payload.header.org_display) ||
    fallbackOrgId
  );
}

function orgComparisonScopeCode(payload: MetricsSurfacePayload) {
  return clean(payload.executive_strip?.runtime?.comparison_scope_code) || "ORG";
}

function tieBreakerValue(row: MetricsSurfaceTeamRow) {
  return (
    numeric(getRowRaw(row, "tie_breaker_value")) ??
    numeric(getRowRaw(row, "jobs_display")) ??
    numeric(getRowRaw(row, "jobs")) ??
    numeric(getRowRaw(row, "job_count")) ??
    numeric(getRowRaw(row, "total_jobs")) ??
    0
  );
}

function withSourceRank(row: MetricsSurfaceTeamRow): MetricsSurfaceTeamRow {
  const sourceRank = sourceRankValue(row);
  const sourceLabel = sourceOrgLabel(row);

  return {
    ...row,
    source_org_rank: sourceRank,
    source_org_label: sourceLabel || null,
    org_rank: sourceRank,
  } as MetricsSurfaceTeamRow;
}

function sortForBpOwnerRank(rows: MetricsSurfaceTeamRow[]) {
  return [...rows].sort((a, b) => {
    const compositeDelta = compositeValue(b) - compositeValue(a);
    if (compositeDelta !== 0) return compositeDelta;

    const tieBreakerDelta = tieBreakerValue(b) - tieBreakerValue(a);
    if (tieBreakerDelta !== 0) return tieBreakerDelta;

    return getRowValue(a, "full_name").localeCompare(getRowValue(b, "full_name"));
  });
}

function assignBpOwnerRank(rows: MetricsSurfaceTeamRow[]) {
  return sortForBpOwnerRank(rows).map((row, index) => {
    const bpOwnerRank = index + 1;

    return {
      ...row,
      bp_owner_rank: bpOwnerRank,
      contractor_rank: bpOwnerRank,
      rank: bpOwnerRank,
    } as MetricsSurfaceTeamRow;
  });
}

function mergeRows(args: {
  payloads: MetricsSurfacePayload[];
  eligibleTechIds: Set<string>;
  eligibleOrgTechPairs: Set<string>;
}) {
  const map = new Map<string, MetricsSurfaceTeamRow>();

  for (const payload of args.payloads) {
    for (const rawRow of payload.team_table.rows) {
      const row = withSourceRank(rawRow);
      const techId = rowTechId(row);
      const orgId = rowOrgId(row);

      if (!techId) continue;
      if (!args.eligibleTechIds.has(techId)) continue;

      if (orgId && !args.eligibleOrgTechPairs.has(`${orgId}::${techId}`)) {
        continue;
      }

      const key = rowKey(row);
      if (!key.trim()) continue;
      if (!map.has(key)) map.set(key, row);
    }
  }

  return assignBpOwnerRank([...map.values()]);
}

export async function getBpOwnerExecutiveMetricsPayload(
  args: Args
): Promise<MetricsSurfacePayload> {
  const bpScope = await resolveBpOwnerScope();

  const metricEligibleAssignments = bpScope.scoped_assignments.filter((row) =>
    Boolean(clean(row.tech_id))
  );

  const techIdsByOrg = groupTechIdsByOrg(metricEligibleAssignments);

  const eligibleTechIds = new Set(
    metricEligibleAssignments.map((row) => clean(row.tech_id)).filter(Boolean)
  );

  const eligibleOrgTechPairs = new Set(
    metricEligibleAssignments
      .map((row) => {
        const orgId = clean(row.pc_org_id);
        const techId = clean(row.tech_id);

        return orgId && techId ? `${orgId}::${techId}` : null;
      })
      .filter(Boolean) as string[]
  );

  const orgPayloads: MetricsSurfacePayload[] = [];
  const bpOwnerOrgKpiRows: BpOwnerOrgKpiRow[] = [];

  for (const orgId of bpScope.covered_pc_org_ids) {
    const scopedTechIds = Array.from(techIdsByOrg.get(orgId) ?? []);

    if (!scopedTechIds.length) continue;

    const payload = await buildMetricsSurfacePayload({
      role_key: "BP_OWNER",
      profile_key: args.profile_key,
      pc_org_id: orgId,
      range: args.range,
      scoped_tech_ids: scopedTechIds,
      role_label: bpScope.role_label,
      rep_full_name: bpScope.rep_full_name,
      visibility: {
        show_jobs: false,
        show_risk: true,
        show_work_mix: false,
        show_parity: false,
      },
    });

    orgPayloads.push(payload);

    bpOwnerOrgKpiRows.push({
      pc_org_id: orgId,
      org_label: orgLabelFromPayload(payload, orgId),
      items: buildExecutiveAggregateStrip({
        payloads: [payload],
        eligible_tech_ids: scopedTechIds,
        support: bpScope.contractor_name ?? "Contractor",
        comparison_scope_code: orgComparisonScopeCode(payload),
      }),
    });
  }

  if (!orgPayloads.length) {
    return {
      ...buildEmptyPayload({
        range: args.range,
        role_label: bpScope.role_label,
        rep_full_name: bpScope.rep_full_name,
      }),
      bp_owner_org_kpi_rows: [],
    } as MetricsSurfacePayload;
  }

  const basePayload = orgPayloads[0];

  const mergedRows = mergeRows({
    payloads: orgPayloads,
    eligibleTechIds,
    eligibleOrgTechPairs,
  });

  const aggregateExecutiveItems = buildExecutiveAggregateStrip({
    payloads: orgPayloads,
    eligible_tech_ids: [...eligibleTechIds],
    support: bpScope.contractor_name ?? "Contractor",
    comparison_scope_code: "JCM",
  });

  return {
    ...basePayload,
    bp_owner_org_kpi_rows: bpOwnerOrgKpiRows,
    executive_strip: {
      ...basePayload.executive_strip,
      base: {
        ...(basePayload.executive_strip?.base ?? {}),
        items: aggregateExecutiveItems,
      },
    },
    header: {
      ...basePayload.header,
      role_label: bpScope.role_label,
      rep_full_name: bpScope.rep_full_name,
      scope_headcount: mergedRows.length,
      total_headcount: mergedRows.length,
      org_display:
        bpScope.contractor_name ??
        basePayload.header.org_display ??
        "Business Partner",
    },
    permissions: {
      ...basePayload.permissions,
      can_filter_scope: true,
    },
    team_table: {
      ...basePayload.team_table,
      rows: mergedRows,
    },
  } as MetricsSurfacePayload;
}

export default getBpOwnerExecutiveMetricsPayload;