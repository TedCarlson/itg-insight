import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";

import {
  isoToday,
  pickBand,
} from "@/features/bp-view/lib/bpViewMetricHelpers";

import { buildBpKpiStrip } from "@/features/bp-view/lib/buildBpKpiStrip";
import { buildBpRiskStrip } from "@/features/bp-view/lib/buildBpRiskStrip";
import { buildBpRosterRows } from "@/features/bp-view/lib/buildBpRosterRows";
import { resolveBpWorkMixByTech } from "@/features/bp-view/lib/kpiResolvers/workMixResolver";
import {
  resolveAllBpKpis,
  type RangeKey,
} from "@/features/bp-view/lib/bpViewResolverRegistry";
import { sortBpRosterRows } from "@/features/bp-view/lib/sortBpRosterRows";

import type {
  CompanySupervisorParityRow,
  CompanySupervisorPayload,
  CompanySupervisorRosterMetricCell,
  CompanySupervisorRosterRow,
} from "./companySupervisorView.types";

import { resolveCompanySupervisorScope } from "./resolveCompanySupervisorScope.server";

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

type RosterColumn = {
  kpi_key: string;
  label: string;
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

  for (const row of defRows ?? []) {
    const k = String(row?.kpi_key ?? "").trim();
    if (!k) continue;

    defByKey.set(k, {
      customer_label: row?.customer_label ?? null,
      label: row?.label ?? null,
    });
  }

  const out: KpiCfg[] = [];

  for (const row of classRows ?? []) {
    const kpi_key = String(row?.kpi_key ?? "").trim();
    if (!kpi_key) continue;

    const enabled = row.is_enabled ?? row.enabled ?? true;
    const show = row.show_in_report ?? true;
    if (!enabled || !show) continue;

    const def = defByKey.get(kpi_key);

    const label = row.label || def?.customer_label || def?.label || kpi_key;
    const sort = row.sort_order ?? 999;

    out.push({
      kpi_key,
      label: String(label),
      sort: Number(sort),
    });
  }

  return out.sort((a, b) => a.sort - b.sort);
}

async function loadRubrics(
  admin: ReturnType<typeof supabaseAdmin>,
  kpiKeys: string[]
): Promise<Map<string, RubricRow[]>> {
  const map = new Map<string, RubricRow[]>();

  const { data } = await admin
    .from("metrics_kpi_rubric")
    .select("kpi_key,band_key,min_value,max_value")
    .eq("is_active", true)
    .in("kpi_key", kpiKeys);

  for (const row of data ?? []) {
    const arr = map.get(row.kpi_key) ?? [];
    arr.push(row);
    map.set(row.kpi_key, arr);
  }

  return map;
}

function pct(part: number, total: number): number | null {
  return total > 0 ? (100 * part) / total : null;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parityPrimaryKpiAggregate(
  row: CompanySupervisorParityRow,
  rosterColumns: RosterColumn[]
) {
  const primaryKeys = rosterColumns.slice(0, 3).map((col) => col.kpi_key);

  const values = primaryKeys
    .map((kpiKey) => row.metrics.find((metric) => metric.kpi_key === kpiKey))
    .map((metric) => safeNumber(metric?.value))
    .filter((value): value is number => value != null);

  if (!values.length) return -1;

  return values.reduce((sum, value) => sum + value, 0);
}

function sortParityRows(
  rows: CompanySupervisorParityRow[],
  rosterColumns: RosterColumn[]
): CompanySupervisorParityRow[] {
  return [...rows].sort((a, b) => {
    const aHasRows = a.hc > 0 ? 1 : 0;
    const bHasRows = b.hc > 0 ? 1 : 0;

    if (aHasRows !== bHasRows) return bHasRows - aHasRows;

    const aPrimary = parityPrimaryKpiAggregate(a, rosterColumns);
    const bPrimary = parityPrimaryKpiAggregate(b, rosterColumns);

    if (aPrimary !== bPrimary) return bPrimary - aPrimary;

    if (a.hc !== b.hc) return b.hc - a.hc;

    return a.label.localeCompare(b.label);
  });
}

function buildParityRows(
  rosterRows: CompanySupervisorRosterRow[],
  rosterColumns: RosterColumn[],
  rubricByKpi: Map<string, RubricRow[]>
): CompanySupervisorParityRow[] {
  const groups = new Map<string, CompanySupervisorRosterRow[]>();

  for (const row of rosterRows) {
    const key = row.contractor_name || row.team_class || "Unknown";
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }

  const out: CompanySupervisorParityRow[] = [];

  for (const [label, rows] of groups.entries()) {
    const metrics: CompanySupervisorRosterMetricCell[] = rosterColumns.map(
      (col) => {
        const values = rows
          .map((r) => r.metrics.find((m) => m.kpi_key === col.kpi_key)?.value)
          .filter((v): v is number => v != null && Number.isFinite(v));

        const avg =
          values.length > 0
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : null;

        return {
          kpi_key: col.kpi_key,
          label: col.label,
          value: avg,
          value_display: avg == null ? null : avg.toFixed(1),
          band_key: pickBand(avg, rubricByKpi.get(col.kpi_key)),
          delta_value: null,
          delta_display: null,
          rank_value: null,
          rank_display: null,
          rank_delta_value: null,
          rank_delta_display: null,
          score_value: null,
          score_weight: null,
          score_contribution: null,
        };
      }
    );

    out.push({
      label,
      metrics,
      hc: rows.length,
    });
  }

  return sortParityRows(out, rosterColumns);
}

export async function getCompanySupervisorViewPayload(
  args: Args
): Promise<CompanySupervisorPayload> {
  const admin = supabaseAdmin();

  const [scope, config] = await Promise.all([
    resolveCompanySupervisorScope(),
    loadViewKpiConfig(admin),
  ]);

  const rubricByKpi = await loadRubrics(
    admin,
    config.map((k) => k.kpi_key)
  );

  const techIds = Array.from(
    new Set(
      scope.scoped_assignments
        .map((r) => {
          const value = r.tech_id;
          return value == null ? null : String(value).trim();
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  const pcOrgIds = Array.from(
    new Set(
      scope.scoped_assignments
        .map((r) => {
          const value = r.pc_org_id;
          return value == null ? null : String(value).trim();
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  const [kpiOverrides, workMixByTech] = await Promise.all([
    resolveAllBpKpis({ admin, techIds, pcOrgIds, range: args.range }),
    resolveBpWorkMixByTech({ admin, techIds, pcOrgIds, range: args.range }),
  ]);

  const rosterColumns: RosterColumn[] = config.map((k) => ({
    kpi_key: k.kpi_key,
    label: k.label,
  }));

  const baseRows = buildBpRosterRows({
    scopedAssignments: scope.scoped_assignments,
    peopleById: scope.people_by_id,
    kpis: config,
    rubricByKpi,
    orgLabelsById: scope.org_labels_by_id,
    workMixByTech,
    kpiOverrides,
  });

  const enrichedRows: CompanySupervisorRosterRow[] = baseRows.map((row) => {
    const assignment = scope.scoped_assignments.find(
      (a) => String(a.tech_id ?? "").trim() === row.tech_id
    );

    return {
      ...row,
      team_class: assignment?.team_class ?? "BP",
      contractor_name:
        assignment?.contractor_name == null
          ? null
          : String(assignment.contractor_name).trim() || null,
    } as CompanySupervisorRosterRow;
  });

  const roster_rows = sortBpRosterRows(
    enrichedRows,
    rosterColumns
  ) as CompanySupervisorRosterRow[];

  const parityRows = buildParityRows(
    roster_rows,
    rosterColumns,
    rubricByKpi
  );

  const kpi_strip = buildBpKpiStrip({
    rosterRows: roster_rows,
    kpis: config,
    rubricByKpi,
  });

  const risk_strip = buildBpRiskStrip({
    rosterRows: roster_rows,
    kpis: config,
  });

  let installs = 0;
  let tcs = 0;
  let sros = 0;

  for (const r of roster_rows) {
    installs += r.work_mix.installs;
    tcs += r.work_mix.tcs;
    sros += r.work_mix.sros;
  }

  const total = installs + tcs + sros;

  return {
    header: {
      role_label: scope.role_label,
      scope_label: scope.company_label ?? "Company Supervisor",
      org_label:
        scope.org_labels_by_id.get(scope.selected_pc_org_id) ??
        scope.selected_pc_org_id,
      org_count: pcOrgIds.length,
      contractor_name: scope.company_label ?? null,
      rep_full_name: scope.rep_full_name ?? null,
      headcount: techIds.length,
      range_label: args.range,
      as_of_date: isoToday(),
    },

    kpi_strip,
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
    parityRows,
  };
}