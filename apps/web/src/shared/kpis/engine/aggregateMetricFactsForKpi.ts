import { aggregateRatio } from "@/shared/kpis/core/aggregateRatio";
import { aggregateTnps } from "@/shared/kpis/core/aggregateTnps";
import { aggregateResolvedValues } from "@/shared/kpis/math/aggregateResolvedValues";
import type {
  KpiDefinitionLike,
  RawMetricPayload,
} from "@/shared/kpis/contracts/kpiTypes";

function pickNum(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key];
    if (value == null) continue;

    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_%]/g, "");
}

function keyAliases(kpiKey: string) {
  const key = normalize(kpiKey);

  const aliasMap: Record<string, string[]> = {
    tnps: ["tnps", "tnpsscore"],
    tnpsscore: ["tnpsscore", "tnps"],

    ftr: ["ftr", "ftrrate"],
    ftrrate: ["ftrrate", "ftr"],

    toolusage: ["toolusage", "toolusagerate", "tool_usage_rate"],
    toolusagerate: ["toolusagerate", "toolusage", "tool_usage_rate"],
    tool_usage_rate: ["tool_usage_rate", "toolusagerate", "toolusage"],

    purepass: ["purepass", "purepassrate", "phtpurepassrate"],
    purepassrate: ["purepassrate", "purepass", "phtpurepassrate"],
    phtpurepassrate: ["phtpurepassrate", "purepassrate", "purepass"],

    contact48hr: ["contact48hr", "contact48hrrate", "callbackrate48hr"],
    contact48hrrate: ["contact48hrrate", "contact48hr", "callbackrate48hr"],
    callbackrate48hr: ["callbackrate48hr", "contact48hrrate", "contact48hr"],

    repeat: ["repeat", "repeatrate"],
    repeatrate: ["repeatrate", "repeat"],

    rework: ["rework", "reworkrate"],
    reworkrate: ["reworkrate", "rework"],

    soi: ["soi", "soirate"],
    soirate: ["soirate", "soi"],

    met: ["met", "metrate"],
    metrate: ["metrate", "met"],
  };

  return aliasMap[key] ?? [key];
}

function isAlias(kpiKey: string, family: string[]) {
  return family.includes(normalize(kpiKey));
}

function computeFtrRate(rows: RawMetricPayload[]): number | null {
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

function computeToolUsageRate(rows: RawMetricPayload[]): number | null {
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

function computePurePassRate(rows: RawMetricPayload[]): number | null {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, ["PHT Pure Pass", "pht_pure_pass", "PHT_Pure_Pass"]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, ["PHT Jobs", "pht_jobs", "PHT_Jobs"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function compute48HrRate(rows: RawMetricPayload[]): number | null {
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

function computeRepeatRate(rows: RawMetricPayload[]): number | null {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, ["Repeat Count", "repeat_count", "RepeatCount"]) ?? 0,
    getDenominator: (row) => pickNum(row, ["TCs", "tcs", "tc_count"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function computeReworkRate(rows: RawMetricPayload[]): number | null {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, ["Rework Count", "rework_count", "ReworkCount"]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, ["TotalAppts", "Total Appts", "total_appts"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function computeSoiRate(rows: RawMetricPayload[]): number | null {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, ["SOI Count", "soi_count", "SOICount"]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, ["Installs", "installs", "install_count"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function computeMetRate(rows: RawMetricPayload[]): number | null {
  const agg = aggregateRatio({
    rows,
    getNumerator: (row) =>
      pickNum(row, ["TotalMetAppts", "Total Met Appts", "total_met_appts"]) ?? 0,
    getDenominator: (row) =>
      pickNum(row, ["TotalAppts", "Total Appts", "total_appts"]) ?? 0,
  });

  return agg.denominator > 0 ? agg.value : null;
}

function computeTnpsRate(rows: RawMetricPayload[]): number | null {
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

export function aggregateMetricFactsForKpi(args: {
  def: KpiDefinitionLike;
  rows: RawMetricPayload[];
}): number | null {
  const aliases = keyAliases(args.def.kpi_key);

  if (isAlias(args.def.kpi_key, ["tnps", "tnpsscore"])) {
    return computeTnpsRate(args.rows);
  }

  if (isAlias(args.def.kpi_key, ["ftr", "ftrrate"])) {
    return computeFtrRate(args.rows);
  }

  if (isAlias(args.def.kpi_key, ["toolusage", "toolusagerate", "tool_usage_rate"])) {
    return computeToolUsageRate(args.rows);
  }

  if (isAlias(args.def.kpi_key, ["purepass", "purepassrate", "phtpurepassrate"])) {
    return computePurePassRate(args.rows);
  }

  if (isAlias(args.def.kpi_key, ["contact48hr", "contact48hrrate", "callbackrate48hr"])) {
    return compute48HrRate(args.rows);
  }

  if (isAlias(args.def.kpi_key, ["repeat", "repeatrate"])) {
    return computeRepeatRate(args.rows);
  }

  if (isAlias(args.def.kpi_key, ["rework", "reworkrate"])) {
    return computeReworkRate(args.rows);
  }

  if (isAlias(args.def.kpi_key, ["soi", "soirate"])) {
    return computeSoiRate(args.rows);
  }

  if (isAlias(args.def.kpi_key, ["met", "metrate"])) {
    return computeMetRate(args.rows);
  }

  return aggregateResolvedValues({
    def: args.def,
    rows: args.rows,
  });
}