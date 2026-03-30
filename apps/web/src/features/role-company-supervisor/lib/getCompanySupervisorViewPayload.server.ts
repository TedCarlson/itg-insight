import { supabaseAdmin } from "@/shared/data/supabase/admin";

import { loadKpiConfig } from "@/shared/kpis/engine/loadKpiConfig.server";
import {
  loadKpiRubric,
  type LoadedKpiRubricRow,
} from "@/shared/kpis/engine/loadKpiRubric.server";
import { buildWorkforceRows } from "@/shared/kpis/engine/buildWorkforceRows";
import { buildWorkMixSummary } from "@/shared/kpis/engine/buildWorkMixSummary";
import { buildParityRows } from "@/shared/kpis/engine/buildParityRows";
import { buildRiskStrip } from "@/shared/kpis/engine/buildRiskStrip";
import { getRankContextByTech } from "@/shared/kpis/engine/getRankContextByTech.server";
import { resolveMetricFactsByTech } from "@/shared/kpis/engine/resolveMetricFactsByTech";
import { resolveOrgMetricFacts } from "@/shared/kpis/engine/resolveOrgMetricFacts";
import type {
  WorkforceMetricCell,
  WorkforceRow,
  WorkforceRubricRow,
} from "@/shared/kpis/engine/workforceTypes";
import { sortWorkforceRows } from "@/shared/kpis/core/sortWorkforceRows";
import { resolveWorkMixByTech } from "@/shared/kpis/engine/resolveWorkMixByTech";
import {
  resolveKpiOverrides,
  type RangeKey,
} from "@/shared/kpis/engine/resolveKpiOverrides";
import { resolveRegionForPcOrg } from "@/shared/org/resolveRegionForPcOrg.server";

import { buildCompanySupervisorKpiStripPayload } from "./buildCompanySupervisorKpiStripPayload";
import { resolveCompanySupervisorScope } from "@/features/company-supervisor-view/lib/resolveCompanySupervisorScope.server";

type ReportClassType = "P4P" | "SMART" | "TECH";

type CompanySupervisorRosterRow = WorkforceRow & {
  team_class: string;
  contractor_name: string | null;
  metrics: WorkforceMetricCell[];
  rank_context?: {
    team: { rank: number; population: number } | null;
    region: { rank: number; population: number } | null;
    division: { rank: number; population: number } | null;
  } | null;
};

type RosterColumn = {
  kpi_key: string;
  label: string;
};

type LegacyRubricRow = WorkforceRubricRow & {
  kpi_key: string;
  band_key: LoadedKpiRubricRow["band_key"];
};

type Args = {
  range?: RangeKey;
  class_type?: ReportClassType;
};

function normalizeClassType(value: string | null | undefined): ReportClassType {
  const upper = String(value ?? "P4P").toUpperCase();
  if (upper === "SMART") return "SMART";
  if (upper === "TECH") return "TECH";
  return "P4P";
}

function toLegacyRubricMap(
  rubricByKpi: Map<string, LoadedKpiRubricRow[]>
): Map<string, LegacyRubricRow[]> {
  const out = new Map<string, LegacyRubricRow[]>();

  for (const [kpi_key, rows] of rubricByKpi.entries()) {
    out.set(
      kpi_key,
      rows.map((row) => ({
        kpi_key,
        band_key: row.band_key,
        min_value: row.min_value,
        max_value: row.max_value,
      }))
    );
  }

  return out;
}

function toMaybeString(value: unknown) {
  const out = String(value ?? "").trim();
  return out || null;
}

function compareRosterRowsByRank(
  a: CompanySupervisorRosterRow,
  b: CompanySupervisorRosterRow
) {
  const aRegion = a.rank_context?.region?.rank ?? Number.POSITIVE_INFINITY;
  const bRegion = b.rank_context?.region?.rank ?? Number.POSITIVE_INFINITY;

  if (aRegion !== bRegion) return aRegion - bRegion;

  const aTeam = a.rank_context?.team?.rank ?? Number.POSITIVE_INFINITY;
  const bTeam = b.rank_context?.team?.rank ?? Number.POSITIVE_INFINITY;

  if (aTeam !== bTeam) return aTeam - bTeam;

  const aName = toMaybeString((a as { full_name?: unknown }).full_name) ?? "";
  const bName = toMaybeString((b as { full_name?: unknown }).full_name) ?? "";

  const nameCompare = aName.localeCompare(bName);
  if (nameCompare !== 0) return nameCompare;

  return String(a.tech_id ?? "").localeCompare(String(b.tech_id ?? ""));
}

export async function getCompanySupervisorViewPayload(args: Args = {}) {
  const admin = supabaseAdmin();
  const range: RangeKey = args.range ?? "FM";
  const class_type: ReportClassType = normalizeClassType(args.class_type);

  const scope = await resolveCompanySupervisorScope();

  const config = await loadKpiConfig({
    class_type: "TECH",
  });

  const loadedRubricByKpi = await loadKpiRubric({
    kpi_keys: config.map((k) => k.kpi_key),
  });

  const rubricByKpi = toLegacyRubricMap(loadedRubricByKpi);

  const techIds = Array.from(
    new Set(
      scope.scoped_assignments
        .map((row) => toMaybeString(row.tech_id))
        .filter((value): value is string => Boolean(value))
    )
  );

  const pcOrgIds = Array.from(
    new Set(
      scope.scoped_assignments
        .map((row) => toMaybeString(row.pc_org_id))
        .filter((value): value is string => Boolean(value))
    )
  );

  const selectedPcOrgId =
    pcOrgIds[0] ?? (toMaybeString(scope.selected_pc_org_id) || null);

  const [
    kpiOverrides,
    workMixByTech,
    metricFactsByTech,
    orgFacts,
    resolvedRegion,
    rankContextByPerson,
  ] = await Promise.all([
    resolveKpiOverrides({
      admin,
      techIds,
      pcOrgIds,
      range,
    }),
    resolveWorkMixByTech({
      admin,
      techIds,
      pcOrgIds,
      range,
    }),
    resolveMetricFactsByTech({
      admin,
      techIds,
      pcOrgIds,
      range,
    }),
    resolveOrgMetricFacts({
      admin,
      pcOrgIds,
      range,
    }),
    resolveRegionForPcOrg({
      pc_org_id: selectedPcOrgId,
    }),
    getRankContextByTech({
      pc_org_ids: pcOrgIds,
      class_type,
    }),
  ]);

  const comparison_scope_code = resolvedRegion?.region_code ?? "ORG";

  const resolvedRegionLike = resolvedRegion as
    | {
        region_name?: string | null;
        division_name?: string | null;
        pc_org_name?: string | null;
      }
    | null
    | undefined;

  const rep_full_name =
    toMaybeString(
      (scope as { rep_full_name?: string | null; full_name?: string | null })
        .rep_full_name ??
        (scope as { rep_full_name?: string | null; full_name?: string | null })
          .full_name
    ) ?? null;

  const division_label = toMaybeString(resolvedRegionLike?.division_name);
  const org_display = toMaybeString(comparison_scope_code);
  const pc_label =
    toMaybeString(resolvedRegionLike?.pc_org_name) ??
    (selectedPcOrgId ? `PC ${scope.company_label ?? ""}`.trim() : null);

  const roster_columns: RosterColumn[] = config.map((k) => ({
    kpi_key: k.kpi_key,
    label: k.label,
  }));

  const baseRows = buildWorkforceRows({
    scopedAssignments: scope.scoped_assignments,
    peopleById: scope.people_by_id,
    kpis: config.map((k) => ({
      kpi_key: k.kpi_key,
      label: k.label,
    })),
    rubricByKpi,
    orgLabelsById: scope.org_labels_by_id,
    workMixByTech,
    kpiOverrides,
  });

  const sortedBaseRows = sortWorkforceRows(baseRows, roster_columns);

  const personIdByTechId = new Map<string, string>();
  for (const assignment of scope.scoped_assignments) {
    const techId = toMaybeString(
      (assignment as { tech_id?: unknown }).tech_id
    );
    if (!techId) continue;

    const personId =
      toMaybeString((assignment as { person_id?: unknown }).person_id) ??
      toMaybeString(
        (assignment as { assignment_person_id?: unknown }).assignment_person_id
      ) ??
      toMaybeString(
        (assignment as { roster_person_id?: unknown }).roster_person_id
      );

    if (!personId) continue;
    personIdByTechId.set(techId, personId);
  }

  const roster_rows_unsorted: CompanySupervisorRosterRow[] = sortedBaseRows.map(
    (row) => {
      const assignment = scope.scoped_assignments.find(
        (a) => toMaybeString(a.tech_id) === row.tech_id
      );

      const personId = personIdByTechId.get(row.tech_id) ?? null;

      return {
        ...row,
        team_class: assignment?.team_class ?? "BP",
        contractor_name:
          assignment?.contractor_name == null
            ? null
            : String(assignment.contractor_name).trim() || null,
        rank_context: personId
          ? rankContextByPerson.get(personId) ?? null
          : null,
      };
    }
  );

  const roster_rows = [...roster_rows_unsorted].sort(compareRosterRowsByRank);

  const supervisorFacts = roster_rows.flatMap(
    (row) => metricFactsByTech.get(row.tech_id) ?? []
  );

  const kpi_strip = buildCompanySupervisorKpiStripPayload({
    definitions: config,
    supervisorFacts,
    orgFacts,
    rubricByKpi: loadedRubricByKpi,
    support: null,
    comparison_scope_code,
  });

  const risk_strip = buildRiskStrip({
    rosterRows: roster_rows,
    kpis: config.map((k) => ({
      kpi_key: k.kpi_key,
      label: k.label,
      sort: k.sort_order,
    })),
  });

  const work_mix = buildWorkMixSummary(roster_rows);

  const parityRows = buildParityRows({
    definitions: config,
    roster_rows,
    rubricByKpi,
    metricFactsByTech,
  });

  return {
    header: {
      role_label: scope.role_label ?? "Company Supervisor",
      rep_full_name,
      division_label,
      org_display,
      pc_label,
      headcount: techIds.length,
      as_of_date: new Date().toISOString(),
      class_type,
      comparison_scope_code,
    },
    rubricByKpi,
    roster_columns,
    kpi_strip,
    risk_strip,
    work_mix,
    parityRows,
    roster_rows,
  };
}