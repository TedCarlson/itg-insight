import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";
import type { BpViewPayload, BpViewRosterRow } from "./bpView.types";
import { isoToday } from "./bpViewMetricHelpers";
import { resolveBpScope } from "./resolveBpScope.server";
import { buildBpRosterRows } from "./buildBpRosterRows";
import { buildBpKpiStrip } from "./buildBpKpiStrip";
import { buildBpRiskStrip } from "./buildBpRiskStrip";
import { resolveBpWorkMixByTech } from "./kpiResolvers/workMixResolver";
import {
  fetchMetricRawRows,
  getFinalRowsPerMonth,
  groupRowsByTech,
  pickNum,
  resolveFiscalEndDatesForRange,
  type RawMetricRow,
} from "./kpiResolvers/shared";
import {
  resolveAllBpKpis,
  type RangeKey,
} from "./bpViewResolverRegistry";
import { sortBpRosterRows } from "./sortBpRosterRows";

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

type TnpsFacts = {
  surveys: number;
  promoters: number;
  passives: number;
  detractors: number;
  tnps_value: number | null;
  tnps_display: string | null;
};

type TnpsContributorRow = {
  tech_id: string;
  full_name: string;
  contractor_name: string | null;
  surveys: number;
  promoters: number;
  passives: number;
  detractors: number;
  tnps_value: number | null;
  tnps_display: string | null;
};

type TnpsPeriodRow = {
  metric_date: string;
  surveys: number;
  promoters: number;
  passives: number;
  detractors: number;
  tnps_value: number | null;
  tnps_display: string | null;
};

function fmtNum(value: number | null | undefined, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(decimals);
}

function computeTnpsScore(
  surveys: number,
  promoters: number,
  detractors: number
): number | null {
  if (surveys <= 0) return null;
  return (100 * (promoters - detractors)) / surveys;
}

function extractTnpsFacts(rows: RawMetricRow[]): TnpsFacts {
  let surveys = 0;
  let promoters = 0;
  let detractors = 0;

  for (const row of rows) {
    surveys +=
      pickNum(row.raw, [
        "tNPS Surveys",
        "tnps_surveys",
        "tNPS_Surveys",
        "Surveys",
      ]) ?? 0;

    promoters +=
      pickNum(row.raw, [
        "Promoters",
        "tnps_promoters",
      ]) ?? 0;

    detractors +=
      pickNum(row.raw, [
        "Detractors",
        "tnps_detractors",
      ]) ?? 0;
  }

  const passives = Math.max(0, surveys - promoters - detractors);
  const tnps_value = computeTnpsScore(surveys, promoters, detractors);

  return {
    surveys,
    promoters,
    passives,
    detractors,
    tnps_value,
    tnps_display: fmtNum(tnps_value, 1),
  };
}

function normalizeRowsForAggregate(rawRows: RawMetricRow[]) {
  const rowsByTech = groupRowsByTech(rawRows);
  const normalized: RawMetricRow[] = [];

  for (const techRows of rowsByTech.values()) {
    const finalRowsByMonth = getFinalRowsPerMonth(techRows);
    for (const month of finalRowsByMonth) {
      normalized.push(month.row);
    }
  }

  return normalized;
}

function buildTnpsInspectionData(args: {
  rawMetricRows: RawMetricRow[];
  rosterRows: BpViewRosterRow[];
}) {
  // --- FULL CHECKPOINT DATA (NO NORMALIZATION)
  const rawRowsByTech = groupRowsByTech(args.rawMetricRows);

  // --- MONTHLY FINAL DATA (NORMALIZED)
  const normalizedRows = normalizeRowsForAggregate(args.rawMetricRows);
  const normalizedRowsByTech = groupRowsByTech(normalizedRows);

  // --- SUMMARY (USES NORMALIZED = CORRECT KPI MATH)
  const summary = extractTnpsFacts(normalizedRows);

  // --- CONTRIBUTORS (ALSO NORMALIZED → stable KPI math)
  const contributors: TnpsContributorRow[] = args.rosterRows
    .map((row) => {
      const techRows = normalizedRowsByTech.get(row.tech_id) ?? [];
      const facts = extractTnpsFacts(techRows);

      return {
        tech_id: row.tech_id,
        full_name: row.full_name,
        contractor_name: row.contractor_name ?? null,
        surveys: facts.surveys,
        promoters: facts.promoters,
        passives: facts.passives,
        detractors: facts.detractors,
        tnps_value: facts.tnps_value,
        tnps_display: facts.tnps_display,
      };
    })
    .filter(
      (row) =>
        row.surveys > 0 ||
        row.promoters > 0 ||
        row.passives > 0 ||
        row.detractors > 0
    )
    .sort(
      (a, b) =>
        b.surveys - a.surveys ||
        a.full_name.localeCompare(b.full_name)
    );

  // --- ALL CHECKPOINTS (RAW)
  const rawByDate = new Map<string, RawMetricRow[]>();

  for (const row of args.rawMetricRows) {
    const metricDate = String(row.metric_date ?? "").trim();
    if (!metricDate) continue;

    const arr = rawByDate.get(metricDate) ?? [];
    arr.push(row);
    rawByDate.set(metricDate, arr);
  }

  const all_checkpoints: TnpsPeriodRow[] = Array.from(rawByDate.entries())
    .map(([metric_date, rows]) => {
      const facts = extractTnpsFacts(rows);

      return {
        metric_date,
        surveys: facts.surveys,
        promoters: facts.promoters,
        passives: facts.passives,
        detractors: facts.detractors,
        tnps_value: facts.tnps_value,
        tnps_display: facts.tnps_display,
      };
    })
    .sort((a, b) => a.metric_date.localeCompare(b.metric_date));

  // --- MONTHLY FINALS (NORMALIZED)
  const finalByDate = new Map<string, RawMetricRow[]>();

  for (const row of normalizedRows) {
    const metricDate = String(row.metric_date ?? "").trim();
    if (!metricDate) continue;

    const arr = finalByDate.get(metricDate) ?? [];
    arr.push(row);
    finalByDate.set(metricDate, arr);
  }

  const monthly_finals: TnpsPeriodRow[] = Array.from(finalByDate.entries())
    .map(([metric_date, rows]) => {
      const facts = extractTnpsFacts(rows);

      return {
        metric_date,
        surveys: facts.surveys,
        promoters: facts.promoters,
        passives: facts.passives,
        detractors: facts.detractors,
        tnps_value: facts.tnps_value,
        tnps_display: facts.tnps_display,
      };
    })
    .sort((a, b) => a.metric_date.localeCompare(b.metric_date));

  return {
    summary,
    contributors,
    all_checkpoints,
    monthly_finals,
  };
}

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

function buildWorkMixFromRosterRows(rows: BpViewRosterRow[]) {
  let installs = 0;
  let tcs = 0;
  let sros = 0;

  for (const row of rows) {
    installs += row.work_mix.installs;
    tcs += row.work_mix.tcs;
    sros += row.work_mix.sros;
  }

  const total = installs + tcs + sros;

  return {
    total,
    installs,
    tcs,
    sros,
    install_pct: pct(installs, total),
    tc_pct: pct(tcs, total),
    sro_pct: pct(sros, total),
  };
}

export async function getBpViewPayload(args: Args): Promise<BpViewPayload> {
  const admin = supabaseAdmin();

  const [scope, p4pConfig] = await Promise.all([
    resolveBpScope(),
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

  const fiscalEndDates = await resolveFiscalEndDatesForRange({
    admin,
    range: args.range,
  });

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
  });

  const roster_rows = sortBpRosterRows(unsortedRosterRows, rosterColumns);

  const kpi_strip = buildBpKpiStrip({
    rosterRows: roster_rows,
    kpis: p4pConfig,
    rubricByKpi,
  });

  const risk_strip = buildBpRiskStrip({
    rosterRows: roster_rows,
    kpis: p4pConfig,
  });

  const work_mix = buildWorkMixFromRosterRows(roster_rows);

  const orgCount = new Set(
    scope.scoped_assignments
      .map((r) => String(r.pc_org_id ?? ""))
      .filter(Boolean)
  ).size;

  const headcount = techIds.length;
  const contractor_name = scope.company_label ?? null;

  const scope_label =
    scope.role_label === "BP Supervisor"
      ? scope.company_label
        ? `${scope.org_labels_by_id.get(scope.selected_pc_org_id) ??
        scope.selected_pc_org_id
        } • ${scope.company_label}`
        : scope.org_labels_by_id.get(scope.selected_pc_org_id) ??
        scope.selected_pc_org_id
      : scope.company_label
        ? `${scope.company_label} • ${orgCount} org${orgCount === 1 ? "" : "s"}`
        : `${orgCount} org${orgCount === 1 ? "" : "s"}`;

  const rollup_tnps = buildTnpsInspectionData({
    rawMetricRows,
    rosterRows: roster_rows,
  });

  return {
    header: {
      role_label: scope.role_label,
      scope_label,
      org_label:
        scope.org_labels_by_id.get(scope.selected_pc_org_id) ??
        scope.selected_pc_org_id,
      org_count: orgCount,
      contractor_name,
      rep_full_name: scope.rep_full_name ?? null,
      headcount,
      range_label: args.range,
      as_of_date: isoToday(),
    },
    kpi_strip,
    risk_strip,
    work_mix,
    roster_columns: rosterColumns,
    roster_rows,
    rollup_tnps,
  } as BpViewPayload;
}