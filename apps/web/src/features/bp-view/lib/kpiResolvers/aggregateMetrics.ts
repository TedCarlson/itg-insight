import { bandLabel, formatValueDisplay, pickBand } from "@/features/bp-view/lib/bpViewMetricHelpers";
import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";

import {
  computePct,
  computeTnpsScore,
  getFinalRowsPerMonth,
  groupRowsByTech,
  pickNum,
  type RawMetricRow,
} from "./shared";

type RubricRow = {
  kpi_key: string;
  band_key: BandKey;
  min_value: number | null;
  max_value: number | null;
};

type AggregateMetricSummary = {
  value: number | null;
  band: BandKey;
  band_label: string;
  value_display: string | null;
};

function normalizeAggregateRows(rawRows: RawMetricRow[]): RawMetricRow[] {
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

export function computeAggregateMetricValue(
  kpiKey: string,
  rawRows: RawMetricRow[]
): number | null {
  const rows = normalizeAggregateRows(rawRows);
  const key = String(kpiKey).trim().toLowerCase();

  if (!rows.length) return null;

  if (key === "tnps" || key === "tnps_score") {
    let totalSurveys = 0;
    let totalPromoters = 0;
    let totalDetractors = 0;

    for (const row of rows) {
      const surveys = pickNum(row.raw, [
        "tNPS Surveys",
        "tnps_surveys",
        "tNPS_Surveys",
        "Surveys",
      ]);
      const promoters = pickNum(row.raw, ["Promoters", "tnps_promoters"]);
      const detractors = pickNum(row.raw, ["Detractors", "tnps_detractors"]);

      if (surveys != null && surveys > 0) {
        totalSurveys += surveys;
        totalPromoters += promoters ?? 0;
        totalDetractors += detractors ?? 0;
      }
    }

    if (totalSurveys > 0) {
      return computeTnpsScore(totalSurveys, totalPromoters, totalDetractors);
    }

    return null;
  }

  if (key === "ftr_rate") {
    let totalContactJobs = 0;
    let totalFailJobs = 0;

    for (const row of rows) {
      const contactJobs = pickNum(row.raw, [
        "Total FTR/Contact Jobs",
        "total_ftr_contact_jobs",
        "ftr_contact_jobs",
      ]);
      const failJobs = pickNum(row.raw, [
        "FTRFailJobs",
        "ftr_fail_jobs",
        "FTR Fail Jobs",
      ]);

      if (contactJobs != null && contactJobs > 0) {
        totalContactJobs += contactJobs;
        totalFailJobs += failJobs ?? 0;
      }
    }

    if (totalContactJobs > 0) {
      return 100 * (1 - totalFailJobs / totalContactJobs);
    }

    return null;
  }

  if (key === "tool_usage" || key === "tool_usage_rate") {
    let totalEligible = 0;
    let totalCompliant = 0;

    for (const row of rows) {
      const eligible = pickNum(row.raw, [
        "TUEligibleJobs",
        "tu_eligible_jobs",
        "TU Eligible Jobs",
      ]);
      const compliant = pickNum(row.raw, [
        "TUResult",
        "tu_result",
        "TU Result",
        "tu_compliant_jobs",
      ]);

      if (eligible != null && eligible > 0) {
        totalEligible += eligible;
        totalCompliant += compliant ?? 0;
      }
    }

    if (totalEligible > 0) {
      return computePct(totalEligible, totalCompliant);
    }

    return null;
  }

  if (key === "pure_pass" || key === "pure_pass_rate" || key === "pht_pure_pass_rate") {
    let totalJobs = 0;
    let totalPurePass = 0;

    for (const row of rows) {
      const jobs = pickNum(row.raw, ["PHT Jobs", "pht_jobs", "PHT_Jobs"]);
      const purePass = pickNum(row.raw, [
        "PHT Pure Pass",
        "pht_pure_pass",
        "PHT_Pure_Pass",
      ]);

      if (jobs != null && jobs > 0) {
        totalJobs += jobs;
        totalPurePass += purePass ?? 0;
      }
    }

    if (totalJobs > 0) {
      return computePct(totalJobs, totalPurePass);
    }

    return null;
  }

  if (key === "contact_48hr" || key === "contact_48hr_rate" || key === "callback_rate_48hr") {
    let totalEligible = 0;
    let totalContacts = 0;

    for (const row of rows) {
      const eligible = pickNum(row.raw, [
        "48Hr Eligible Orders",
        "48hr_eligible_orders",
        "48hr eligible",
        "callback_48hr_eligible",
        "Total Orders",
        "total_orders",
      ]);
      const contacts = pickNum(row.raw, [
        "48Hr Contact Orders",
        "48HrContactOrders",
        "contact_orders_48hr",
        "callback_48hr_contacts",
      ]);

      if (eligible != null && eligible > 0) {
        totalEligible += eligible;
        totalContacts += contacts ?? 0;
      }
    }

    if (totalEligible > 0) {
      return computePct(totalEligible, totalContacts);
    }

    return null;
  }

  if (key === "repeat" || key === "repeat_rate") {
    let totalJobs = 0;
    let totalRepeats = 0;

    for (const row of rows) {
      const jobs = pickNum(row.raw, [
        "Repeat Eligible Jobs",
        "repeat_eligible_jobs",
        "Repeat Jobs",
        "repeat_jobs",
        "Total Jobs",
        "total_jobs",
      ]);
      const repeats = pickNum(row.raw, [
        "Repeat Jobs Count",
        "repeat_jobs_count",
        "repeat_count",
        "Repeat Count",
      ]);

      if (jobs != null && jobs > 0) {
        totalJobs += jobs;
        totalRepeats += repeats ?? 0;
      }
    }

    if (totalJobs > 0) {
      return computePct(totalJobs, totalRepeats);
    }

    return null;
  }

  if (key === "rework" || key === "rework_rate") {
    let totalAppts = 0;
    let totalRework = 0;

    for (const row of rows) {
      const totalAppointments = pickNum(row.raw, [
        "TotalAppts",
        "Total Appts",
        "total_appts",
        "Total Appointments",
        "total_appointments",
      ]);
      const reworkCount = pickNum(row.raw, [
        "Rework Count",
        "rework_count",
        "ReworkCount",
      ]);

      if (totalAppointments != null && totalAppointments > 0) {
        totalAppts += totalAppointments;
        totalRework += reworkCount ?? 0;
      }
    }

    if (totalAppts > 0) {
      return computePct(totalAppts, totalRework);
    }

    return null;
  }

  if (key === "soi" || key === "soi_rate") {
    let totalInstalls = 0;
    let totalSoi = 0;

    for (const row of rows) {
      const installs = pickNum(row.raw, [
        "Installs",
        "installs",
        "install_count",
        "Install Count",
        "Total Installs",
        "total_installs",
      ]);
      const soiCount = pickNum(row.raw, [
        "SOI Count",
        "soi_count",
        "SOICount",
        "SOI",
      ]);

      if (installs != null && installs > 0) {
        totalInstalls += installs;
        totalSoi += soiCount ?? 0;
      }
    }

    if (totalInstalls > 0) {
      return computePct(totalInstalls, totalSoi);
    }

    return null;
  }

  if (key === "met" || key === "met_rate") {
    let totalAppts = 0;
    let totalMet = 0;

    for (const row of rows) {
      const totalAppointments = pickNum(row.raw, [
        "TotalAppts",
        "Total Appts",
        "total_appts",
        "Total Appointments",
        "total_appointments",
      ]);
      const metCount = pickNum(row.raw, [
        "TotalMetAppts",
        "Total Met Appts",
        "total_met_appts",
        "MET Count",
        "met_count",
      ]);

      if (totalAppointments != null && totalAppointments > 0) {
        totalAppts += totalAppointments;
        totalMet += metCount ?? 0;
      }
    }

    if (totalAppts > 0) {
      return computePct(totalAppts, totalMet);
    }

    return null;
  }

  return null;
}

export function buildAggregateMetricMap(args: {
  rawRows: RawMetricRow[];
  metricOrder: Array<{ kpi_key: string; label: string }>;
  rubricByKpi: Map<string, RubricRow[]>;
}): Map<string, AggregateMetricSummary> {
  const out = new Map<string, AggregateMetricSummary>();

  for (const metric of args.metricOrder) {
    const value = computeAggregateMetricValue(metric.kpi_key, args.rawRows);
    const band = pickBand(value, args.rubricByKpi.get(metric.kpi_key));

    out.set(metric.kpi_key, {
      value,
      band,
      band_label: bandLabel(band),
      value_display: formatValueDisplay(metric.kpi_key, value),
    });
  }

  return out;
}