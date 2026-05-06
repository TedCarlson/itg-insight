// path: apps/web/src/features/role-company-manager/lib/getCompanyManagerSurfacePayload.server.ts

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { buildMetricsSurfacePayload } from "@/shared/server/metrics/buildMetricsSurfacePayload.server";
import type {
  MetricsRangeKey,
  MetricsSurfacePayload,
  MetricsSurfaceTeamRow,
} from "@/shared/types/metrics/surfacePayload";
import {
  resolveCompanyManagerScope,
  type CompanyManagerScopeAssignmentRow,
} from "./resolveCompanyManagerScope.server";
import { loadWorkforceSourceRows } from "@/shared/server/workforce/loadWorkforceSourceRows.server";

type CompanyManagerProfileKey = "NSR" | "SMART";

type ManagerScopeMeta = {
  person_id: string | null;
  office_label: string | null;
  reports_to_person_id: string | null;
  reports_to_label: string | null;
  leader_name: string | null;
  leader_title: string | null;
  team_class: "ITG" | "BP" | null;
  contractor_name: string | null;
  office_id: string | null;
  affiliation_type: string | null;
  co_code: string | null;
  supervisor_chain_person_ids: string[];
};

type EnrichedMetricsSurfaceTeamRow = MetricsSurfaceTeamRow & {
  person_id?: string | null;
  leader_name?: string | null;
  leader_title?: string | null;
  team_class?: "ITG" | "BP" | null;
  contractor_name?: string | null;
  office_id?: string | null;
  affiliation?: string | null;
  supervisor_chain_person_ids?: string[];
};

function normalizeProfileKey(
  value: string | null | undefined
): CompanyManagerProfileKey {
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

function joinLeaderLabel(args: {
  leader_name: string | null;
  leader_title: string | null;
}) {
  const name = String(args.leader_name ?? "").trim();
  const title = String(args.leader_title ?? "").trim();

  if (name && title) return `${name} • ${title}`;
  if (name) return name;
  if (title) return title;
  return null;
}

function normalizeChain(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function buildEmptyPayload(range: MetricsRangeKey): MetricsSurfacePayload {
  return {
    header: {
      role_label: "Company Supervisor",
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

function toScopeMeta(row: CompanyManagerScopeAssignmentRow): ManagerScopeMeta {
  const leaderLabel = joinLeaderLabel({
    leader_name: row.leader_name ?? null,
    leader_title: row.leader_title ?? null,
  });

  return {
    person_id: row.person_id ?? null,
    office_label: row.office_name ?? null,
    reports_to_person_id: row.leader_person_id ?? null,
    reports_to_label: leaderLabel,
    leader_name: row.leader_name ?? null,
    leader_title: row.leader_title ?? null,
    team_class: row.team_class ?? null,
    contractor_name: row.contractor_name ?? null,
    office_id: row.office_id ?? null,
    affiliation_type:
      row.team_class === "ITG"
        ? "COMPANY"
        : row.team_class === "BP"
          ? "CONTRACTOR"
          : null,
    co_code: row.contractor_name ?? null,
    supervisor_chain_person_ids: normalizeChain(
      row.supervisor_chain_person_ids
    ),
  };
}

export async function getCompanyManagerSurfacePayload(args?: {
  profile_key?: string | null;
  range?: string | null;
}): Promise<MetricsSurfacePayload> {
  const scope = await requireSelectedPcOrgServer();
  const profileKey = normalizeProfileKey(args?.profile_key);
  const activeRange = normalizeRangeKey(args?.range);

  if (!scope.ok) {
    return buildEmptyPayload(activeRange);
  }

  const resolvedScope = await resolveCompanyManagerScope();

  const workforceRowsForScope = await loadWorkforceSourceRows({
    pc_org_id: scope.selected_pc_org_id,
    as_of_date: new Date().toISOString().slice(0, 10),
  });

  const scopedTechIds = Array.from(
    new Set(
      workforceRowsForScope
        .filter((row) => row.is_active)
        .filter((row) => row.is_field)
        .map((row) => String(row.tech_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const basePayload = await buildMetricsSurfacePayload({
    role_key: "COMPANY_MANAGER",
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

  const workforceRows = workforceRowsForScope;

  const workforceByTechId = new Map(
    workforceRows
      .filter((r) => r.tech_id)
      .map((r) => [String(r.tech_id).trim(), r])
  );

  const workforceByAssignmentId = new Map(
    workforceRows
      .filter((r) => r.assignment_id)
      .map((r) => [String(r.assignment_id).trim(), r])
  );

  function buildWorkforceSupervisorChain(row: any): string[] {
    const chain: string[] = [];
    const seen = new Set<string>();

    let parentAssignmentId = String(row?.reports_to_assignment_id ?? "").trim();

    while (parentAssignmentId && !seen.has(parentAssignmentId)) {
      seen.add(parentAssignmentId);

      const parent = workforceByAssignmentId.get(parentAssignmentId);
      if (!parent) break;

      const parentPersonId = String(parent.person_id ?? "").trim();
      if (parentPersonId) chain.push(parentPersonId);

      parentAssignmentId = String(parent.reports_to_assignment_id ?? "").trim();
    }

    return chain;
  }

  const scopeByTechId = new Map<string, ManagerScopeMeta>(
    resolvedScope.scoped_assignments
      .filter((row) => Boolean(String(row.tech_id ?? "").trim()))
      .map((row) => [String(row.tech_id ?? "").trim(), toScopeMeta(row)])
  );

  const scopeByPersonId = new Map<string, ManagerScopeMeta>(
    resolvedScope.scoped_assignments
      .filter((row) => Boolean(String(row.person_id ?? "").trim()))
      .map((row) => [String(row.person_id ?? "").trim(), toScopeMeta(row)])
  );

  const enrichedRows: EnrichedMetricsSurfaceTeamRow[] =
    basePayload.team_table.rows.map((row) => {
      const unsafeRow = row as MetricsSurfaceTeamRow & {
        person_id?: string | null;
        office_id?: string | null;
        affiliation?: string | null;
        contractor_name?: string | null;
        leader_name?: string | null;
        leader_title?: string | null;
        team_class?: "ITG" | "BP" | null;
        supervisor_chain_person_ids?: string[];
      };

      const techId = String(row.tech_id ?? "").trim();
      const wf = workforceByTechId.get(techId);
      const wfAffiliationCode = String((wf as any)?.affiliation_code ?? "").trim().toUpperCase();
      const wfAffiliationName = String(wf?.affiliation ?? "").trim();

      const wfTeamClass =
        wfAffiliationCode === "ITG" || wfAffiliationName === "Integrated Tech Group"
          ? "ITG"
          : wfAffiliationName
            ? "BP"
            : null;
      const personId = String(unsafeRow.person_id ?? "").trim();

      const scopeMeta =
        (techId ? scopeByTechId.get(techId) : undefined) ??
        (personId ? scopeByPersonId.get(personId) : undefined);

      const rowAffiliation =
        row.affiliation_type && row.affiliation_type !== "UNKNOWN"
          ? row.affiliation_type
          : null;

      const resolvedAffiliationType =
        wfTeamClass === "ITG"
          ? "COMPANY"
          : wfTeamClass === "BP"
            ? "CONTRACTOR"
            : scopeMeta?.affiliation_type ?? rowAffiliation ?? null;

      const resolvedTeamClass =
        wfTeamClass ??
        scopeMeta?.team_class ??
        unsafeRow.team_class ??
        (resolvedAffiliationType === "COMPANY"
          ? "ITG"
          : resolvedAffiliationType === "CONTRACTOR"
            ? "BP"
            : null);

      return {
        ...row,

        person_id: unsafeRow.person_id ?? scopeMeta?.person_id ?? null,
        office_label: scopeMeta?.office_label ?? row.office_label ?? null,
        affiliation_type: resolvedAffiliationType,
        reports_to_person_id:
          scopeMeta?.reports_to_person_id ??
          row.reports_to_person_id ??
          null,
        reports_to_label:
          scopeMeta?.reports_to_label ?? row.reports_to_label ?? null,

        co_code: scopeMeta?.co_code ?? row.co_code ?? null,
        leader_name: scopeMeta?.leader_name ?? unsafeRow.leader_name ?? null,
        leader_title: scopeMeta?.leader_title ?? unsafeRow.leader_title ?? null,
        team_class: resolvedTeamClass,
        contractor_name:
          wfTeamClass === "BP"
            ? (wfAffiliationName || scopeMeta?.contractor_name || unsafeRow.contractor_name || null)
            : null,
        office_id: scopeMeta?.office_id ?? unsafeRow.office_id ?? null,
        affiliation: unsafeRow.affiliation ?? null,
        supervisor_chain_person_ids:
          wf ? buildWorkforceSupervisorChain(wf) :
            scopeMeta?.supervisor_chain_person_ids?.length
              ? scopeMeta.supervisor_chain_person_ids
              : normalizeChain(unsafeRow.supervisor_chain_person_ids),
      };
    });

  return {
    ...basePayload,
    executive_strip: basePayload.executive_strip ?? {
      base: { items: [] },
      scope: null,
      runtime: null,
    },
    header: {
      ...basePayload.header,
      total_headcount: enrichedRows.length,
      scope_headcount: enrichedRows.length,
    },
    team_table: {
      ...basePayload.team_table,
      rows: enrichedRows,
    },
  };
}