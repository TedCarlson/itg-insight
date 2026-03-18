import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type MetricsRangeKey = "FM" | "3FM" | "12FM";

type Args = {
  person_id: string;
  tech_id: string;
  range: MetricsRangeKey;
};

type RawRow = {
  metric_date: string;
  fiscal_end_date: string;
  batch_id: string;
  raw: Record<string, unknown>;
};

function pickNum(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function computeTnpsScore(surveys: number, promoters: number, detractors: number): number | null {
  if (surveys > 0) return (100 * (promoters - detractors)) / surveys;
  return null;
}

function monthsToTake(range: MetricsRangeKey) {
  if (range === "3FM") return 3;
  if (range === "12FM") return 12;
  return 1;
}

function groupByMonth(rows: RawRow[]) {
  const map = new Map<string, RawRow[]>();

  for (const r of rows) {
    const key = r.fiscal_end_date;
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }

  return map;
}

function getFinalRowPerMonth(rows: RawRow[]) {
  const grouped = groupByMonth(rows);
  const out: Array<{
    fiscal_end_date: string;
    row: RawRow;
    rows_in_month: number;
  }> = [];

  for (const [fiscal_end_date, arr] of grouped) {
    arr.sort((a, b) => {
      const byMetricDate = b.metric_date.localeCompare(a.metric_date);
      if (byMetricDate !== 0) return byMetricDate;
      return b.batch_id.localeCompare(a.batch_id);
    });

    out.push({
      fiscal_end_date,
      row: arr[0],
      rows_in_month: arr.length,
    });
  }

  out.sort((a, b) => b.fiscal_end_date.localeCompare(a.fiscal_end_date));
  return out;
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

export async function getMetricTnpsPayload(args: Args) {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) return null;

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("metrics_raw_row")
    .select("metric_date,fiscal_end_date,batch_id,raw")
    .eq("pc_org_id", scope.selected_pc_org_id)
    .eq("tech_id", args.tech_id)
    .order("fiscal_end_date", { ascending: false })
    .order("metric_date", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`getMetricTnpsPayload failed: ${error.message}`);
  }

  const rows: RawRow[] = (data ?? []).map((r: any) => ({
    metric_date: String(r.metric_date ?? "").slice(0, 10),
    fiscal_end_date: String(r.fiscal_end_date ?? "").slice(0, 10),
    batch_id: String(r.batch_id ?? ""),
    raw: parseRaw(r.raw),
  }));

  if (!rows.length) return null;

  const finalRowsByMonth = getFinalRowPerMonth(rows);
  const distinctFiscalMonthsFound = finalRowsByMonth.map((x) => x.fiscal_end_date);
  const selectedMonthCount = monthsToTake(args.range);
  const selectedFinalRows = finalRowsByMonth.slice(0, selectedMonthCount);
  const selectedFiscalMonths = new Set(selectedFinalRows.map((x) => x.fiscal_end_date));

  let totalSurveys = 0;
  let totalPromoters = 0;
  let totalDetractors = 0;

  for (const item of selectedFinalRows) {
    const r = item.row;

    const surveys = pickNum(r.raw, [
      "tNPS Surveys",
      "tnps_surveys",
      "tNPS_Surveys",
      "Surveys",
    ]);

    const promoters = pickNum(r.raw, [
      "Promoters",
      "tnps_promoters",
    ]);

    const detractors = pickNum(r.raw, [
      "Detractors",
      "tnps_detractors",
    ]);

    if (surveys != null && surveys > 0) {
      totalSurveys += surveys;
      if (promoters != null) totalPromoters += promoters;
      if (detractors != null) totalDetractors += detractors;
    }
  }

  const summaryTnps = computeTnpsScore(totalSurveys, totalPromoters, totalDetractors);

  const monthFinalMap = new Set(
    selectedFinalRows.map(
      (x) => `${x.row.fiscal_end_date}::${x.row.metric_date}::${x.row.batch_id}`
    )
  );

  const trend = rows
    .filter((r) => selectedFiscalMonths.has(r.fiscal_end_date))
    .map((r) => {
      const surveys = pickNum(r.raw, [
        "tNPS Surveys",
        "tnps_surveys",
        "tNPS_Surveys",
        "Surveys",
      ]);

      const promoters = pickNum(r.raw, [
        "Promoters",
        "tnps_promoters",
      ]);

      const detractors = pickNum(r.raw, [
        "Detractors",
        "tnps_detractors",
      ]);

      const kpiValue =
        surveys != null && surveys > 0
          ? computeTnpsScore(surveys, promoters ?? 0, detractors ?? 0)
          : null;

      return {
        fiscal_end_date: r.fiscal_end_date,
        metric_date: r.metric_date,
        batch_id: r.batch_id,
        tnps_surveys: surveys,
        tnps_promoters: promoters,
        tnps_detractors: detractors,
        kpi_value: kpiValue,
        is_month_final: monthFinalMap.has(
          `${r.fiscal_end_date}::${r.metric_date}::${r.batch_id}`
        ),
      };
    })
    .sort((a, b) => {
      const byFiscal = a.fiscal_end_date.localeCompare(b.fiscal_end_date);
      if (byFiscal !== 0) return byFiscal;
      const byMetric = a.metric_date.localeCompare(b.metric_date);
      if (byMetric !== 0) return byMetric;
      return a.batch_id.localeCompare(b.batch_id);
    });

  return {
    debug: {
      requested_range: args.range,
      distinct_fiscal_month_count: distinctFiscalMonthsFound.length,
      distinct_fiscal_months_found: distinctFiscalMonthsFound,
      selected_month_count: selectedFinalRows.length,
      selected_final_rows: selectedFinalRows.map((x) => {
        const surveys = pickNum(x.row.raw, [
          "tNPS Surveys",
          "tnps_surveys",
          "tNPS_Surveys",
          "Surveys",
        ]);

        const promoters = pickNum(x.row.raw, [
          "Promoters",
          "tnps_promoters",
        ]);

        const detractors = pickNum(x.row.raw, [
          "Detractors",
          "tnps_detractors",
        ]);

        return {
          fiscal_end_date: x.row.fiscal_end_date,
          metric_date: x.row.metric_date,
          batch_id: x.row.batch_id,
          rows_in_month: x.rows_in_month,
          tnps_surveys: surveys,
          tnps_promoters: promoters,
          tnps_detractors: detractors,
        };
      }),
      trend,
    },
    summary: {
      tnps_score: summaryTnps,
      tnps_surveys: totalSurveys,
      tnps_promoters: totalPromoters,
      tnps_detractors: totalDetractors,
    },
    trend,
  };
}