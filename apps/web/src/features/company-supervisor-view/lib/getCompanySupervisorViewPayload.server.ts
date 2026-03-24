import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";

import { isoToday } from "@/features/bp-view/lib/bpViewMetricHelpers";
import { buildBpKpiStrip } from "@/features/bp-view/lib/buildBpKpiStrip";
import { buildBpRiskStrip } from "@/features/bp-view/lib/buildBpRiskStrip";
import { buildBpRosterRows } from "@/features/bp-view/lib/buildBpRosterRows";
import { resolveBpWorkMixByTech } from "@/features/bp-view/lib/kpiResolvers/workMixResolver";
import {
  resolveAllBpKpis,
  type RangeKey,
} from "@/features/bp-view/lib/bpViewResolverRegistry";

import type {
  CompanySupervisorPayload,
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

export async function getCompanySupervisorViewPayload(
  args: Args
): Promise<CompanySupervisorPayload> {
  const admin = supabaseAdmin();

  const [scope, p4pConfig] = await Promise.all([
    resolveCompanySupervisorScope(),
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

  const [kpiOverrides, workMixByTech] = await Promise.all([
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
    }),
  ]);

  const roster_rows = buildBpRosterRows({
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
    );

    return {
      ...row,
      team_class: assignment?.team_class ?? "BP",
      contractor_name: assignment?.contractor_name ?? null,
    };
  }) as CompanySupervisorRosterRow[];

  const kpi_strip = buildBpKpiStrip({
    rosterRows: roster_rows as any,
    kpis: p4pConfig,
    rubricByKpi,
  });

  const risk_strip = buildBpRiskStrip({
    rosterRows: roster_rows as any,
    kpis: p4pConfig,
  });

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
      scope_label: scope.company_label ?? "Company Supervisor",
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

    roster_columns: p4pConfig.map((k) => ({
      kpi_key: k.kpi_key,
      label: k.label,
    })),

    roster_rows,
  };
}