// path: src/shared/kpis/engine/resolveKpiOverrides.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { resolveFiscalSelection } from "@/shared/kpis/core/rowSelection";
import { aggregateRatio } from "@/shared/kpis/core/aggregateRatio";
import { aggregateTnps } from "@/shared/kpis/core/aggregateTnps";
import type { MetricsRangeKey, RawMetricRow } from "@/shared/kpis/core/types";

type TechMetricRow = RawMetricRow & {
  tech_id: string;
};

type MetricFact = Record<string, unknown>;

export type RangeKey = MetricsRangeKey;
export type KpiOverrideMaps = Record<string, Map<string, number | null>>;
export type ReportClassType = "P4P" | "SMART" | "TECH";

type Args = {
  admin?: ReturnType<typeof supabaseAdmin>;
  techIds: string[];
  pcOrgIds: string[];
  range: RangeKey;
  class_type?: ReportClassType;
};

type FactViewRow = {
  tech_id: string | null;
  metric_date: string | null;
  fiscal_end_date: string | null;
  batch_id: string | null;
  inserted_at: string | null;
  tnps_score: number | string | null;
  ftr_rate: number | string | null;
  tool_usage_rate: number | string | null;
  contact_48hr_rate: number | string | null;
  pht_pure_pass_rate: number | string | null;
  met_rate: number | string | null;
  soi_rate: number | string | null;
  repeat_rate: number | string | null;
  rework_rate: number | string | null;
  tnps_surveys: number | string | null;
  tnps_promoters: number | string | null;
  tnps_detractors: number | string | null;
  total_jobs: number | string | null;
  total_appts: number | string | null;
  total_met_appts: number | string | null;
  total_ftr_contact_jobs: number | string | null;
  ftr_fail_jobs: number | string | null;
  tu_eligible_jobs: number | string | null;
  tu_compliant_jobs: number | string | null;
  contact_48hr_orders: number | string | null;
  repeat_count: number | string | null;
  rework_count: number | string | null;
};

function emptyOverrides(): KpiOverrideMaps {
  const make = () => new Map<string, number | null>();

  return {
    tnps: make(),
    tnps_score: make(),

    ftr_rate: make(),

    tool_usage: make(),
    tool_usage_rate: make(),

    pure_pass: make(),
    pure_pass_rate: make(),
    pht_pure_pass_rate: make(),

    contact_48hr: make(),
    contact_48hr_rate: make(),
    callback_rate_48hr: make(),

    repeat: make(),
    repeat_rate: make(),

    rework: make(),
    rework_rate: make(),

    soi: make(),
    soi_rate: make(),

    met: make(),
    met_rate: make(),

    composite: make(),
    composite_score: make(),
    weighted_score: make(),
    ws: make(),
  };
}

function toNum(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickNum(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key];
    if (value == null) continue;

    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function groupRowsByTech(rows: TechMetricRow[]) {
  const map = new Map<string, TechMetricRow[]>();

  for (const row of rows) {
    const techId = String(row.tech_id ?? "").trim();
    if (!techId) continue;

    const arr = map.get(techId) ?? [];
    arr.push(row);
    map.set(techId, arr);
  }

  return map;
}

function factViewRowToTechMetricRow(row: FactViewRow): TechMetricRow {
  const raw: Record<string, unknown> = {
    tnps_score: toNum(row.tnps_score),
    ftr_rate: toNum(row.ftr_rate),
    tool_usage_rate: toNum(row.tool_usage_rate),
    contact_48hr_rate: toNum(row.contact_48hr_rate),
    pht_pure_pass_rate: toNum(row.pht_pure_pass_rate),
    met_rate: toNum(row.met_rate),
    soi_rate: toNum(row.soi_rate),
    repeat_rate: toNum(row.repeat_rate),
    rework_rate: toNum(row.rework_rate),

    tnps_surveys: toNum(row.tnps_surveys),
    tnps_promoters: toNum(row.tnps_promoters),
    tnps_detractors: toNum(row.tnps_detractors),
    total_jobs: toNum(row.total_jobs),
    total_appts: toNum(row.total_appts),
    total_met_appts: toNum(row.total_met_appts),
    total_ftr_contact_jobs: toNum(row.total_ftr_contact_jobs),
    ftr_fail_jobs: toNum(row.ftr_fail_jobs),
    tu_eligible_jobs: toNum(row.tu_eligible_jobs),
    tu_compliant_jobs: toNum(row.tu_compliant_jobs),
    contact_48hr_orders: toNum(row.contact_48hr_orders),
    repeat_count: toNum(row.repeat_count),
    rework_count: toNum(row.rework_count),

    Promoters: toNum(row.tnps_promoters),
    Detractors: toNum(row.tnps_detractors),
    "tNPS Surveys": toNum(row.tnps_surveys),

    "Total FTR/Contact Jobs": toNum(row.total_ftr_contact_jobs),
    FTRFailJobs: toNum(row.ftr_fail_jobs),

    TUEligibleJobs: toNum(row.tu_eligible_jobs),
    TUResult: toNum(row.tu_compliant_jobs),

    "48Hr Contact Orders": toNum(row.contact_48hr_orders),

    "Repeat Count": toNum(row.repeat_count),
    "Rework Count": toNum(row.rework_count),

    TotalAppts: toNum(row.total_appts),
    TotalMetAppts: toNum(row.total_met_appts),

    "tNPS Rate": toNum(row.tnps_score),
    "FTR%": toNum(row.ftr_rate),
    ToolUsage: toNum(row.tool_usage_rate),
    "48Hr Contact Rate%": toNum(row.contact_48hr_rate),
    "PHT Pure Pass%": toNum(row.pht_pure_pass_rate),
    MetRate: toNum(row.met_rate),
    "SOI Rate%": toNum(row.soi_rate),
    "Repeat Rate%": toNum(row.repeat_rate),
    "Rework Rate%": toNum(row.rework_rate),
  };

  return {
    tech_id: String(row.tech_id ?? "").trim(),
    metric_date: String(row.metric_date ?? "").slice(0, 10),
    fiscal_end_date: String(row.fiscal_end_date ?? "").slice(0, 10),
    batch_id: String(row.batch_id ?? ""),
    inserted_at: String(row.inserted_at ?? ""),
    raw,
  };
}

function computeFtrRate(rows: MetricFact[]): number | null {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) => {
      const contact =
        pickNum(row, [
          "Total FTR/Contact Jobs",
          "total_ftr_contact_jobs",
          "ftr_contact_jobs",
        ]) ?? 0;

      const fails =
        pickNum(row, ["FTRFailJobs", "ftr_fail_jobs", "FTR Fail Jobs"]) ?? 0;

      return Math.max(0, contact - fails);
    },
    getDenominator: (row) =>
      pickNum(row, [
        "Total FTR/Contact Jobs",
        "total_ftr_contact_jobs",
        "ftr_contact_jobs",
      ]) ?? 0,
  });

  if (agg.denominator > 0) return agg.value;

  const totalFails = rows.reduce(
    (sum, row) =>
      sum +
      (pickNum(row, ["FTRFailJobs", "ftr_fail_jobs", "FTR Fail Jobs"]) ?? 0),
    0
  );

  return totalFails > 0 ? 0 : null;
}

function computeToolUsageRate(rows: MetricFact[]): number | null {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, [
        "TUResult",
        "tu_result",
        "TU Result",
        "tu_compliant_jobs",
      ]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, [
        "TUEligibleJobs",
        "tu_eligible_jobs",
        "TU Eligible Jobs",
      ]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function averageDirectRate(rows: MetricFact[], keys: string[]): number | null {
  const values = rows
    .map((row) => pickNum(row, keys))
    .filter((value): value is number => value != null);

  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computePurePassRate(rows: MetricFact[]): number | null {
  return averageDirectRate(rows, ["pht_pure_pass_rate", "PHT Pure Pass%"]);
}

function compute48HrRate(rows: MetricFact[]): number | null {
  const direct = averageDirectRate(rows, [
    "contact_48hr_rate",
    "48Hr Contact Rate%",
  ]);
  if (direct != null) return direct;

  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, [
        "48Hr Contact Orders",
        "48HrContactOrders",
        "contact_orders_48hr",
      ]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, [
        "Total FTR/Contact Jobs",
        "total_ftr_contact_jobs",
        "ftr_contact_jobs",
      ]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function computeRepeatRate(rows: MetricFact[]): number | null {
  return averageDirectRate(rows, ["repeat_rate", "Repeat Rate%"]);
}

function computeReworkRate(rows: MetricFact[]): number | null {
  return averageDirectRate(rows, ["rework_rate", "Rework Rate%"]);
}

function computeSoiRate(rows: MetricFact[]): number | null {
  return averageDirectRate(rows, ["soi_rate", "SOI Rate%"]);
}

function computeMetRate(rows: MetricFact[]): number | null {
  const direct = averageDirectRate(rows, ["met_rate", "MetRate"]);
  if (direct != null) return direct;

  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, ["TotalMetAppts", "Total Met Appts", "total_met_appts"]) ??
      0,
    getDenominator: (row) =>
      pickNum(row, ["TotalAppts", "Total Appts", "total_appts"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function computeTnpsRate(rows: MetricFact[]): number | null {
  const direct = averageDirectRate(rows, ["tnps_score", "tNPS Rate"]);
  if (direct != null) return direct;

  return aggregateTnps(
    rows.map((row) => ({
      tnps_surveys:
        pickNum(row, [
          "tNPS Surveys",
          "tnps_surveys",
          "tNPS_Surveys",
          "Surveys",
        ]) ?? 0,
      tnps_promoters: pickNum(row, ["Promoters", "tnps_promoters"]) ?? 0,
      tnps_detractors: pickNum(row, ["Detractors", "tnps_detractors"]) ?? 0,
    }))
  ).tnps_score;
}

function shiftTodayByMonths(monthsBack: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

function resolveRangeStartDate(range: RangeKey): string {
  if (range === "FM") return shiftTodayByMonths(0);
  if (range === "PREVIOUS") return shiftTodayByMonths(2);
  if (range === "3FM") return shiftTodayByMonths(3);
  if (range === "12FM") return shiftTodayByMonths(11);
  return "2000-01-01";
}

export async function resolveKpiOverrides(args: Args): Promise<KpiOverrideMaps> {
  const admin = args.admin ?? supabaseAdmin();
  const { techIds, pcOrgIds, range } = args;

  const overrides = emptyOverrides();

  if (!techIds.length || !pcOrgIds.length) {
    return overrides;
  }

  const startDate = resolveRangeStartDate(range);

  const factQuery = admin
    .from("metrics_tech_fact_day")
    .select(
      "pc_org_id,tech_id,metric_date,fiscal_end_date,batch_id,inserted_at,tnps_score,ftr_rate,tool_usage_rate,contact_48hr_rate,pht_pure_pass_rate,met_rate,soi_rate,repeat_rate,rework_rate,tnps_surveys,tnps_promoters,tnps_detractors,total_jobs,total_appts,total_met_appts,total_ftr_contact_jobs,ftr_fail_jobs,tu_eligible_jobs,tu_compliant_jobs,contact_48hr_orders,repeat_count,rework_count"
    )
    .in("pc_org_id", pcOrgIds)
    .in("tech_id", techIds)
    .gte("fiscal_end_date", startDate)
    .order("fiscal_end_date", { ascending: false })
    .order("metric_date", { ascending: false })
    .order("inserted_at", { ascending: false })
    .order("batch_id", { ascending: false })
    .limit(10000);

  const { data, error } = await factQuery;

  if (error) {
    throw new Error(`resolveKpiOverrides failed: ${error.message}`);
  }

  const rows: TechMetricRow[] = ((data ?? []) as FactViewRow[]).map(
    factViewRowToTechMetricRow
  );

  const rowsByTech = groupRowsByTech(rows);

  for (const techId of techIds) {
    const techRows = rowsByTech.get(techId) ?? [];
    const { selectedFinalRows } = resolveFiscalSelection(techRows, range);
    const selectedFacts = selectedFinalRows.map((item) => item.row.raw);

    const tnps = computeTnpsRate(selectedFacts);
    const ftr = computeFtrRate(selectedFacts);
    const toolUsage = computeToolUsageRate(selectedFacts);
    const purePass = computePurePassRate(selectedFacts);
    const contact48 = compute48HrRate(selectedFacts);
    const repeat = computeRepeatRate(selectedFacts);
    const rework = computeReworkRate(selectedFacts);
    const soi = computeSoiRate(selectedFacts);
    const met = computeMetRate(selectedFacts);

    overrides.tnps.set(techId, tnps);
    overrides.tnps_score.set(techId, tnps);

    overrides.ftr_rate.set(techId, ftr);

    overrides.tool_usage.set(techId, toolUsage);
    overrides.tool_usage_rate.set(techId, toolUsage);

    overrides.pure_pass.set(techId, purePass);
    overrides.pure_pass_rate.set(techId, purePass);
    overrides.pht_pure_pass_rate.set(techId, purePass);

    overrides.contact_48hr.set(techId, contact48);
    overrides.contact_48hr_rate.set(techId, contact48);
    overrides.callback_rate_48hr.set(techId, contact48);

    overrides.repeat.set(techId, repeat);
    overrides.repeat_rate.set(techId, repeat);

    overrides.rework.set(techId, rework);
    overrides.rework_rate.set(techId, rework);

    overrides.soi.set(techId, soi);
    overrides.soi_rate.set(techId, soi);

    overrides.met.set(techId, met);
    overrides.met_rate.set(techId, met);
  }

  return overrides;
}