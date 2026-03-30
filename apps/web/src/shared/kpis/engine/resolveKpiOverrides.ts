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

type Args = {
  admin?: ReturnType<typeof supabaseAdmin>;
  techIds: string[];
  pcOrgIds: string[];
  range: RangeKey;
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
  };
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

function parseRaw(raw: unknown): Record<string, unknown> {
  if (!raw) return {};

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof raw === "object" ? (raw as Record<string, unknown>) : {};
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
        pickNum(row, [
          "FTRFailJobs",
          "ftr_fail_jobs",
          "FTR Fail Jobs",
        ]) ?? 0;

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
      pickNum(row, ["TUResult", "tu_result", "TU Result", "tu_compliant_jobs"]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, ["TUEligibleJobs", "tu_eligible_jobs", "TU Eligible Jobs"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function computePurePassRate(rows: MetricFact[]): number | null {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, ["PHT Pure Pass", "pht_pure_pass", "PHT_Pure_Pass"]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, ["PHT Jobs", "pht_jobs", "PHT_Jobs"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function compute48HrRate(rows: MetricFact[]): number | null {
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
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, ["Repeat Count", "repeat_count", "RepeatCount"]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, ["TCs", "tcs", "tc_count"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function computeReworkRate(rows: MetricFact[]): number | null {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, ["Rework Count", "rework_count", "ReworkCount"]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, ["TotalAppts", "Total Appts", "total_appts"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function computeSoiRate(rows: MetricFact[]): number | null {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, ["SOI Count", "soi_count", "SOICount"]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, ["Installs", "installs", "install_count"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function computeMetRate(rows: MetricFact[]): number | null {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, ["TotalMetAppts", "Total Met Appts", "total_met_appts"]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, ["TotalAppts", "Total Appts", "total_appts"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function computeTnpsRate(rows: MetricFact[]): number | null {
  return aggregateTnps(
    rows.map((row) => ({
      tnps_surveys:
        pickNum(row, ["tNPS Surveys", "tnps_surveys", "tNPS_Surveys", "Surveys"]) ?? 0,
      tnps_promoters: pickNum(row, ["Promoters", "tnps_promoters"]) ?? 0,
      tnps_detractors: pickNum(row, ["Detractors", "tnps_detractors"]) ?? 0,
    }))
  ).tnps_score;
}

export async function resolveKpiOverrides(args: Args): Promise<KpiOverrideMaps> {
  const admin = args.admin ?? supabaseAdmin();
  const { techIds, pcOrgIds, range } = args;

  const overrides = emptyOverrides();

  if (!techIds.length || !pcOrgIds.length) {
    return overrides;
  }

  const { data, error } = await admin
    .from("metrics_raw_row")
    .select("pc_org_id,tech_id,metric_date,fiscal_end_date,batch_id,inserted_at,raw")
    .in("pc_org_id", pcOrgIds)
    .in("tech_id", techIds)
    .order("fiscal_end_date", { ascending: false })
    .order("metric_date", { ascending: false })
    .order("inserted_at", { ascending: false })
    .order("batch_id", { ascending: false })
    .limit(10000);

  if (error) {
    throw new Error(`resolveKpiOverrides failed: ${error.message}`);
  }

  const rows: TechMetricRow[] = (data ?? []).map((row: any) => ({
    tech_id: String(row.tech_id ?? ""),
    metric_date: String(row.metric_date ?? "").slice(0, 10),
    fiscal_end_date: String(row.fiscal_end_date ?? "").slice(0, 10),
    batch_id: String(row.batch_id ?? ""),
    inserted_at: String(row.inserted_at ?? ""),
    raw: parseRaw(row.raw),
  }));

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