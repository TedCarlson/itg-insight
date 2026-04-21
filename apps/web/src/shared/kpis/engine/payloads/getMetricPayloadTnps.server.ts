// path: apps/web/src/shared/kpis/engine/payloads/getMetricPayloadTnps.server.ts

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { resolveFiscalSelection } from "@/shared/kpis/core/rowSelection";
import { aggregateTnps } from "@/shared/kpis/core/aggregateTnps";
import type { MetricsRangeKey, RawMetricRow } from "@/shared/kpis/core/types";

export type GetMetricPayloadTnpsArgs = {
  person_id: string;
  tech_id: string;
  range: MetricsRangeKey;
};

function pickNum(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj?.[key];
    if (value == null) continue;

    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
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

function extractTnpsFacts(raw: Record<string, unknown>) {
  return {
    tnps_surveys: pickNum(raw, [
      "tNPS Surveys",
      "tnps_surveys",
      "tNPS_Surveys",
      "Surveys",
    ]),
    tnps_promoters: pickNum(raw, ["Promoters", "tnps_promoters"]),
    tnps_detractors: pickNum(raw, ["Detractors", "tnps_detractors"]),
  };
}

export async function getMetricPayloadTnps(
  args: GetMetricPayloadTnpsArgs
) {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) return null;

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("metrics_raw_row")
    .select("metric_date,fiscal_end_date,batch_id,inserted_at,raw")
    .eq("pc_org_id", scope.selected_pc_org_id)
    .eq("tech_id", args.tech_id)
    .order("fiscal_end_date", { ascending: false })
    .order("metric_date", { ascending: false })
    .order("inserted_at", { ascending: false })
    .order("batch_id", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`getMetricPayloadTnps failed: ${error.message}`);
  }

  const rows: RawMetricRow[] = (data ?? []).map((row: any) => ({
    metric_date: String(row.metric_date ?? "").slice(0, 10),
    fiscal_end_date: String(row.fiscal_end_date ?? "").slice(0, 10),
    batch_id: String(row.batch_id ?? ""),
    inserted_at: String(row.inserted_at ?? ""),
    raw: parseRaw(row.raw),
  }));

  if (!rows.length) return null;

  const {
    finalRowsByMonth,
    selectedFinalRows,
    selectedFiscalMonths,
  } = resolveFiscalSelection(rows, args.range);

  const distinctFiscalMonthsFound = finalRowsByMonth.map(
    (item) => item.fiscal_end_date
  );

  const summaryRows =
    args.range === "FM" || args.range === "PREVIOUS"
      ? selectedFinalRows.length
        ? [selectedFinalRows[0].row]
        : []
      : selectedFinalRows.map((item) => item.row);

  const summaryFacts = summaryRows.map((row) => extractTnpsFacts(row.raw));
  const summaryAgg = aggregateTnps(summaryFacts);

  const monthFinalMap = new Set(
    selectedFinalRows.map(
      (item) =>
        `${item.row.fiscal_end_date}::${item.row.metric_date}::${item.row.inserted_at}::${item.row.batch_id}`
    )
  );

  const trend = rows
    .filter((row) => selectedFiscalMonths.has(row.fiscal_end_date))
    .map((row) => {
      const facts = extractTnpsFacts(row.raw);
      const agg = aggregateTnps([facts]);

      return {
        fiscal_end_date: row.fiscal_end_date,
        metric_date: row.metric_date,
        batch_id: row.batch_id,
        inserted_at: row.inserted_at,
        tnps_surveys: facts.tnps_surveys,
        tnps_promoters: facts.tnps_promoters,
        tnps_detractors: facts.tnps_detractors,
        kpi_value: agg.tnps_score,
        is_month_final: monthFinalMap.has(
          `${row.fiscal_end_date}::${row.metric_date}::${row.inserted_at}::${row.batch_id}`
        ),
      };
    })
    .sort((a, b) => {
      const byFiscal = a.fiscal_end_date.localeCompare(b.fiscal_end_date);
      if (byFiscal !== 0) return byFiscal;

      const byMetric = a.metric_date.localeCompare(b.metric_date);
      if (byMetric !== 0) return byMetric;

      const byInsertedAt = a.inserted_at.localeCompare(b.inserted_at);
      if (byInsertedAt !== 0) return byInsertedAt;

      return a.batch_id.localeCompare(b.batch_id);
    });

  return {
    debug: {
      requested_range: args.range,
      distinct_fiscal_month_count: distinctFiscalMonthsFound.length,
      distinct_fiscal_months_found: distinctFiscalMonthsFound,
      selected_month_count: selectedFinalRows.length,
      selected_final_rows: selectedFinalRows.map((item) => {
        const facts = extractTnpsFacts(item.row.raw);

        return {
          fiscal_end_date: item.row.fiscal_end_date,
          metric_date: item.row.metric_date,
          batch_id: item.row.batch_id,
          inserted_at: item.row.inserted_at,
          rows_in_month: item.rows_in_month,
          tnps_surveys: facts.tnps_surveys,
          tnps_promoters: facts.tnps_promoters,
          tnps_detractors: facts.tnps_detractors,
        };
      }),
      trend,
    },
    summary: {
      tnps_score: summaryAgg.tnps_score,
      tnps_surveys: summaryAgg.tnps_surveys,
      tnps_promoters: summaryAgg.tnps_promoters,
      tnps_detractors: summaryAgg.tnps_detractors,
    },
    trend,
  };
}