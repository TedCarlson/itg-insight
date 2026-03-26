import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";

import { bandLabel, formatValueDisplay, isoToday } from "@/features/bp-view/lib/bpViewMetricHelpers";
import { buildBpRiskStrip } from "@/features/bp-view/lib/buildBpRiskStrip";
import { buildBpRosterRows } from "@/features/bp-view/lib/buildBpRosterRows";
import { sortBpRosterRows } from "@/features/bp-view/lib/sortBpRosterRows";
import {
  buildAggregateMetricMap,
  computeAggregateMetricValue,
} from "@/features/bp-view/lib/kpiResolvers/aggregateMetrics";
import {
  fetchMetricRawRows,
  resolveFiscalEndDatesForRange,
  type RawMetricRow,
} from "@/features/bp-view/lib/kpiResolvers/shared";
import { resolveBpWorkMixByTech } from "@/features/bp-view/lib/kpiResolvers/workMixResolver";
import {
  resolveAllBpKpis,
  type RangeKey,
} from "@/features/bp-view/lib/bpViewResolverRegistry";

import type {
  CompanyManagerLeadershipRollupRow,
  CompanyManagerOfficeRollupRow,
  CompanyManagerPayload,
  CompanyManagerRosterRow,
} from "./companyManagerView.types";
import { resolveCompanyManagerScope } from "./resolveCompanyManagerScope.server";

type Args = {
  range: RangeKey;
};

type KpiCfg = {
  kpi_key: string;
  label: string;
  sort: number;
};

type RubricRow = {
  kpi_key: string;
  band_key: BandKey;
  min_value: number | null;
  max_value: number | null;
};

type ScopeKey = "ALL" | "ITG" | "BP";

type AssignmentMeta = {
  tech_id: string;
  office: string;
  team_class: "ITG" | "BP";
  contractor_name: string | null;
  leader_key: string;
  leader_name: string;
  leader_title: string | null;
};

async function loadViewKpiConfig(
  admin: ReturnType<typeof supabaseAdmin>
): Promise<KpiCfg[]> {
  const [{ data: classRows }, { data: defRows }] = await Promise.all([
    admin.from("metrics_class_kpi_config").select("*").eq("class_type", "TECH"),
    admin.from("metrics_kpi_def").select("kpi_key,customer_label,label"),
  ]);

  const defByKey = new Map<
    string,
    { customer_label?: string | null; label?: string | null }
  >();

  for (const row of (defRows ?? []) as Array<{
    kpi_key?: unknown;
    customer_label?: unknown;
    label?: unknown;
  }>) {
    const k = String(row?.kpi_key ?? "").trim();
    if (!k) continue;

    defByKey.set(k, {
      customer_label:
        row?.customer_label == null ? null : String(row.customer_label),
      label: row?.label == null ? null : String(row.label),
    });
  }

  const out: KpiCfg[] = [];

  for (const row of (classRows ?? []) as Array<Record<string, unknown>>) {
    const kpi_key = String(row?.kpi_key ?? "").trim();
    if (!kpi_key) continue;

    const enabled =
      row.is_enabled ?? row.enabled ?? row.is_active ?? row.active ?? true;
    const show = row.show_in_report ?? row.show ?? true;
    if (!enabled || !show) continue;

    const def = defByKey.get(kpi_key);

    const label =
      (row.label && String(row.label).trim()) ||
      (def?.customer_label && String(def.customer_label).trim()) ||
      (def?.label && String(def.label).trim()) ||
      kpi_key;

    const sort =
      row.sort_order ?? row.display_order ?? row.report_order ?? 999;

    out.push({
      kpi_key,
      label: String(label),
      sort: Number(sort),
    });
  }

  out.sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  return out;
}

async function loadRubrics(
  admin: ReturnType<typeof supabaseAdmin>,
  kpiKeys: string[]
): Promise<Map<string, RubricRow[]>> {
  const out = new Map<string, RubricRow[]>();
  if (!kpiKeys.length) return out;

  const { data } = await admin
    .from("metrics_kpi_rubric")
    .select("kpi_key,band_key,min_value,max_value")
    .eq("is_active", true)
    .in("kpi_key", kpiKeys);

  for (const row of (data ?? []) as Array<{
    kpi_key: string;
    band_key: BandKey;
    min_value: number | null;
    max_value: number | null;
  }>) {
    const key = String(row.kpi_key);
    const arr = out.get(key) ?? [];
    arr.push({
      kpi_key: key,
      band_key: row.band_key,
      min_value: row.min_value,
      max_value: row.max_value,
    });
    out.set(key, arr);
  }

  return out;
}

function pct(part: number, total: number): number | null {
  if (total <= 0) return null;
  return (100 * part) / total;
}

function resolveOfficeLabel(assignment: Record<string, unknown>, orgLabelsById: Map<string, string>) {
  const directOffice =
    assignment?.office_name ??
    assignment?.office ??
    assignment?.market_name ??
    assignment?.market ??
    assignment?.branch_name ??
    assignment?.branch ??
    null;

  if (directOffice != null && String(directOffice).trim()) {
    return String(directOffice).trim();
  }

  const pcOrgId = String(assignment?.pc_org_id ?? "").trim();
  if (pcOrgId && orgLabelsById.has(pcOrgId)) return orgLabelsById.get(pcOrgId) ?? pcOrgId;
  return pcOrgId || "Unknown";
}

function buildAssignmentMeta(scope: Awaited<ReturnType<typeof resolveCompanyManagerScope>>) {
  const out = new Map<string, AssignmentMeta>();

  for (const assignment of scope.scoped_assignments as Array<Record<string, unknown>>) {
    const techId = String(assignment.tech_id ?? "").trim();
    if (!techId) continue;

    const leaderName = String(assignment.leader_name ?? "").trim() || "Unassigned";
    const leaderTitle = assignment.leader_title == null ? null : String(assignment.leader_title).trim() || null;

    out.set(techId, {
      tech_id: techId,
      office: resolveOfficeLabel(assignment, scope.org_labels_by_id),
      team_class: String(assignment.team_class ?? "BP") === "ITG" ? "ITG" : "BP",
      contractor_name: assignment.contractor_name == null ? null : String(assignment.contractor_name).trim() || null,
      leader_key: `${leaderName}::${leaderTitle ?? ""}`,
      leader_name: leaderName,
      leader_title: leaderTitle,
    });
  }

  return out;
}

function groupRawRowsByTech(rows: RawMetricRow[]) {
  const out = new Map<string, RawMetricRow[]>();
  for (const row of rows) {
    const arr = out.get(row.tech_id) ?? [];
    arr.push(row);
    out.set(row.tech_id, arr);
  }
  return out;
}

function buildKpiStripFromRaw(args: {
  rawRows: RawMetricRow[];
  kpis: KpiCfg[];
  rubricByKpi: Map<string, RubricRow[]>;
  techCount: number;
}) {
  return args.kpis.map((kpi) => {
    const value = computeAggregateMetricValue(kpi.kpi_key, args.rawRows);
    const band_key = buildAggregateMetricMap({
      rawRows: args.rawRows,
      metricOrder: [{ kpi_key: kpi.kpi_key, label: kpi.label }],
      rubricByKpi: args.rubricByKpi,
    }).get(kpi.kpi_key)?.band ?? "NO_DATA";

    return {
      kpi_key: kpi.kpi_key,
      label: kpi.label,
      value,
      value_display: formatValueDisplay(kpi.kpi_key, value),
      band_key,
      band_label: bandLabel(band_key),
      support: `${args.techCount} techs in scope`,
    };
  });
}

function filterRosterRowsForScope(rows: CompanyManagerRosterRow[], scopeKey: ScopeKey, contractor?: string) {
  if (scopeKey === "ITG") return rows.filter((row) => row.team_class === "ITG");
  if (scopeKey === "BP") {
    return rows.filter((row) => row.team_class === "BP" && (!contractor || row.contractor_name === contractor));
  }
  return rows;
}

function filterTechIdsForScope(techIds: string[], metaByTech: Map<string, AssignmentMeta>, scopeKey: ScopeKey, contractor?: string) {
  return techIds.filter((techId) => {
    const meta = metaByTech.get(techId);
    if (!meta) return false;
    if (scopeKey === "ITG") return meta.team_class === "ITG";
    if (scopeKey === "BP") return meta.team_class === "BP" && (!contractor || meta.contractor_name === contractor);
    return true;
  });
}

function buildOfficeRollups(args: {
  rosterRows: CompanyManagerRosterRow[];
  techIds: string[];
  rawRowsByTech: Map<string, RawMetricRow[]>;
  metaByTech: Map<string, AssignmentMeta>;
  metricOrder: Array<{ kpi_key: string; label: string }>;
  rubricByKpi: Map<string, RubricRow[]>;
  scopeKey: ScopeKey;
  contractor?: string;
}): CompanyManagerOfficeRollupRow[] {
  const rows = filterRosterRowsForScope(args.rosterRows, args.scopeKey, args.contractor);
  const scopedTechIds = new Set(filterTechIdsForScope(args.techIds, args.metaByTech, args.scopeKey, args.contractor));
  const grouped = new Map<string, CompanyManagerRosterRow[]>();

  for (const row of rows) {
    const office =
      args.metaByTech.get(row.tech_id)?.office ??
      (String(row.context ?? "").trim() || "Unknown");
    const arr = grouped.get(office) ?? [];
    arr.push(row);
    grouped.set(office, arr);
  }

  const out: CompanyManagerOfficeRollupRow[] = [];

  for (const [office, officeRows] of grouped.entries()) {
    const officeTechIds = officeRows.map((row) => row.tech_id).filter((techId) => scopedTechIds.has(techId));
    const rawRows = officeTechIds.flatMap((techId) => args.rawRowsByTech.get(techId) ?? []);

    out.push({
      office,
      headcount: officeRows.length,
      jobs: officeRows.reduce((sum, row) => sum + row.work_mix.total, 0),
      installs: officeRows.reduce((sum, row) => sum + row.work_mix.installs, 0),
      tcs: officeRows.reduce((sum, row) => sum + row.work_mix.tcs, 0),
      sros: officeRows.reduce((sum, row) => sum + row.work_mix.sros, 0),
      below_target_count: officeRows.reduce((sum, row) => sum + row.below_target_count, 0),
      metrics: buildAggregateMetricMap({
        rawRows,
        metricOrder: args.metricOrder,
        rubricByKpi: args.rubricByKpi,
      }),
      metric_order: args.metricOrder,
    });
  }

  return out.sort((a, b) => a.office.localeCompare(b.office));
}

function buildLeadershipRollups(args: {
  rosterRows: CompanyManagerRosterRow[];
  techIds: string[];
  rawRowsByTech: Map<string, RawMetricRow[]>;
  metaByTech: Map<string, AssignmentMeta>;
  metricOrder: Array<{ kpi_key: string; label: string }>;
  rubricByKpi: Map<string, RubricRow[]>;
  scopeKey: ScopeKey;
  contractor?: string;
}): CompanyManagerLeadershipRollupRow[] {
  const rows = filterRosterRowsForScope(args.rosterRows, args.scopeKey, args.contractor);
  const scopedTechIds = new Set(filterTechIdsForScope(args.techIds, args.metaByTech, args.scopeKey, args.contractor));
  const grouped = new Map<string, CompanyManagerRosterRow[]>();

  for (const row of rows) {
    const leaderKey = args.metaByTech.get(row.tech_id)?.leader_key ?? "Unassigned::";
    const arr = grouped.get(leaderKey) ?? [];
    arr.push(row);
    grouped.set(leaderKey, arr);
  }

  const out: CompanyManagerLeadershipRollupRow[] = [];

  for (const [leaderKey, leaderRows] of grouped.entries()) {
    const sampleMeta = args.metaByTech.get(leaderRows[0]?.tech_id ?? "");
    const leaderTechIds = leaderRows.map((row) => row.tech_id).filter((techId) => scopedTechIds.has(techId));
    const rawRows = leaderTechIds.flatMap((techId) => args.rawRowsByTech.get(techId) ?? []);

    out.push({
      leader_key: leaderKey,
      leader_name: sampleMeta?.leader_name ?? "Unassigned",
      leader_title: sampleMeta?.leader_title ?? null,
      headcount: leaderRows.length,
      jobs: leaderRows.reduce((sum, row) => sum + row.work_mix.total, 0),
      installs: leaderRows.reduce((sum, row) => sum + row.work_mix.installs, 0),
      tcs: leaderRows.reduce((sum, row) => sum + row.work_mix.tcs, 0),
      sros: leaderRows.reduce((sum, row) => sum + row.work_mix.sros, 0),
      below_target_count: leaderRows.reduce((sum, row) => sum + row.below_target_count, 0),
      metrics: buildAggregateMetricMap({
        rawRows,
        metricOrder: args.metricOrder,
        rubricByKpi: args.rubricByKpi,
      }),
      metric_order: args.metricOrder,
    });
  }

  return out.sort((a, b) =>
    a.leader_name.localeCompare(b.leader_name) ||
    String(a.leader_title ?? "").localeCompare(String(b.leader_title ?? ""))
  );
}

export async function getCompanyManagerViewPayload(
  args: Args
): Promise<CompanyManagerPayload> {
  const admin = supabaseAdmin();

  const [scope, p4pConfig] = await Promise.all([
    resolveCompanyManagerScope(),
    loadViewKpiConfig(admin),
  ]);

  const rubricByKpi = await loadRubrics(
    admin,
    p4pConfig.map((k) => k.kpi_key)
  );

  const techIds = Array.from(
    new Set(
      scope.scoped_assignments
        .map((r) => String(r.tech_id ?? ""))
        .filter(Boolean)
    )
  );

  const pcOrgIds = Array.from(
    new Set(
      scope.scoped_assignments
        .map((r) => String(r.pc_org_id ?? ""))
        .filter(Boolean)
    )
  );

  const fiscalEndDates = await resolveFiscalEndDatesForRange({ admin, range: args.range });

  const [kpiOverrides, workMixByTech, rawMetricRows] = await Promise.all([
    resolveAllBpKpis({
      admin,
      techIds,
      pcOrgIds,
      range: args.range,
    }),
    resolveBpWorkMixByTech({
      admin,
      techIds,
      pcOrgIds,
      range: args.range,
      fiscalEndDates,
    }),
    fetchMetricRawRows({
      admin,
      techIds,
      pcOrgIds,
      fiscalEndDates,
    }),
  ]);

  const rosterColumns = p4pConfig.map((k) => ({
    kpi_key: k.kpi_key,
    label: k.label,
  }));

  const unsortedRosterRows = buildBpRosterRows({
    scopedAssignments: scope.scoped_assignments,
    peopleById: scope.people_by_id,
    factByTech: new Map(),
    kpis: p4pConfig,
    rubricByKpi,
    orgLabelsById: scope.org_labels_by_id,
    workMixByTech,
    kpiOverrides,
  }).map((row) => {
    const assignment = scope.scoped_assignments.find(
      (a) => String(a.tech_id ?? "") === row.tech_id
    ) as Record<string, unknown> | undefined;

    return {
      ...row,
      team_class: String(assignment?.team_class ?? "BP") === "ITG" ? "ITG" : "BP",
      contractor_name:
        assignment?.contractor_name == null
          ? null
          : (String(assignment.contractor_name).trim() || null),
    };
  }) as CompanyManagerRosterRow[];

  const roster_rows = sortBpRosterRows(
    unsortedRosterRows,
    rosterColumns
  ) as CompanyManagerRosterRow[];

  const risk_strip = buildBpRiskStrip({
    rosterRows: roster_rows as any,
    kpis: p4pConfig,
  });

  const rawRowsByTech = groupRawRowsByTech(rawMetricRows);
  const metaByTech = buildAssignmentMeta(scope);

  let installs = 0;
  let tcs = 0;
  let sros = 0;

  for (const row of roster_rows) {
    installs += row.work_mix.installs;
    tcs += row.work_mix.tcs;
    sros += row.work_mix.sros;
  }

  const total = installs + tcs + sros;

  const orgIds = Array.from(
    new Set(
      scope.scoped_assignments
        .map((r) => String(r.pc_org_id ?? ""))
        .filter(Boolean)
    )
  );

  return {
    header: {
      role_label: scope.role_label,
      scope_label: scope.company_label ?? "Company Manager",
      org_label:
        scope.org_labels_by_id.get(scope.selected_pc_org_id) ??
        scope.selected_pc_org_id,
      org_count: orgIds.length,
      contractor_name: scope.company_label ?? null,
      rep_full_name: scope.rep_full_name ?? null,
      headcount: techIds.length,
      range_label: args.range,
      as_of_date: isoToday(),
    },

    kpi_strip: buildKpiStripFromRaw({
      rawRows: rawMetricRows,
      kpis: p4pConfig,
      rubricByKpi,
      techCount: techIds.length,
    }),
    risk_strip,

    work_mix: {
      total,
      installs,
      tcs,
      sros,
      install_pct: pct(installs, total),
      tc_pct: pct(tcs, total),
      sro_pct: pct(sros, total),
    },

    roster_columns: rosterColumns,
    roster_rows,
    office_rollups: {
      ALL: buildOfficeRollups({ rosterRows: roster_rows, techIds, rawRowsByTech, metaByTech, metricOrder: rosterColumns, rubricByKpi, scopeKey: "ALL" }),
      ITG: buildOfficeRollups({ rosterRows: roster_rows, techIds, rawRowsByTech, metaByTech, metricOrder: rosterColumns, rubricByKpi, scopeKey: "ITG" }),
      BP: buildOfficeRollups({ rosterRows: roster_rows, techIds, rawRowsByTech, metaByTech, metricOrder: rosterColumns, rubricByKpi, scopeKey: "BP" }),
      BP_BY_CONTRACTOR: Object.fromEntries(
        Array.from(new Set(roster_rows.filter((row) => row.team_class === "BP").map((row) => row.contractor_name).filter(Boolean))).map((contractor) => [
          contractor,
          buildOfficeRollups({ rosterRows: roster_rows, techIds, rawRowsByTech, metaByTech, metricOrder: rosterColumns, rubricByKpi, scopeKey: "BP", contractor: contractor ?? undefined }),
        ])
      ),
    },
    leadership_rollups: {
      ALL: buildLeadershipRollups({ rosterRows: roster_rows, techIds, rawRowsByTech, metaByTech, metricOrder: rosterColumns, rubricByKpi, scopeKey: "ALL" }),
      ITG: buildLeadershipRollups({ rosterRows: roster_rows, techIds, rawRowsByTech, metaByTech, metricOrder: rosterColumns, rubricByKpi, scopeKey: "ITG" }),
      BP: buildLeadershipRollups({ rosterRows: roster_rows, techIds, rawRowsByTech, metaByTech, metricOrder: rosterColumns, rubricByKpi, scopeKey: "BP" }),
      BP_BY_CONTRACTOR: Object.fromEntries(
        Array.from(new Set(roster_rows.filter((row) => row.team_class === "BP").map((row) => row.contractor_name).filter(Boolean))).map((contractor) => [
          contractor,
          buildLeadershipRollups({ rosterRows: roster_rows, techIds, rawRowsByTech, metaByTech, metricOrder: rosterColumns, rubricByKpi, scopeKey: "BP", contractor: contractor ?? undefined }),
        ])
      ),
    },
  };
}
