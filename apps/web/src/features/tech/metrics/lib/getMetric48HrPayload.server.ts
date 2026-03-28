import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { resolveFiscalSelection } from "@/shared/kpis/core/rowSelection";
import { aggregateRatio } from "@/shared/kpis/core/aggregateRatio";

import type { MetricsRangeKey, RawMetricRow } from "@/shared/kpis/core/types";

type Args = {
  person_id: string;
  tech_id: string;
  range: MetricsRangeKey;
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

function pickOrders(raw: Record<string, unknown>) {
  return pickNum(raw, [
    "48Hr Contact Orders",
    "48HrContactOrders",
    "contact_orders_48hr",
  ]);
}

function pickEligible(raw: Record<string, unknown>) {
  return pickNum(raw, [
    "Total FTR/Contact Jobs",
    "total_ftr_contact_jobs",
    "ftr_contact_jobs",
  ]);
}

function pickDirectRate(raw: Record<string, unknown>) {
  return pickNum(raw, [
    "48Hr Contact Rate%",
    "48Hr Contact Rate %",
    "48HrContactRate",
    "contact_rate_48hr",
  ]);
}

function extract48HrFacts(raw: Record<string, unknown>) {
  const eligible = pickEligible(raw);
  const orders = pickOrders(raw);
  const directRate = pickDirectRate(raw);

  const agg = aggregateRatio({
    rows: [{ eligible, orders }],
    getNumerator: (row) => row.orders ?? 0,
    getDenominator: (row) => row.eligible ?? 0,
  });

  return {
    contact_orders_48hr: orders,
    eligible_jobs_48hr: eligible,
    callback_rate_48hr: agg.denominator > 0 ? agg.value : directRate,
    usesFacts: agg.denominator > 0,
  };
}

export async function getMetric48HrPayload(args: Args) {
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
    throw new Error(`getMetric48HrPayload failed: ${error.message}`);
  }

  const rows: RawMetricRow[] = (data ?? []).map((r: any) => ({
    metric_date: String(r.metric_date ?? "").slice(0, 10),
    fiscal_end_date: String(r.fiscal_end_date ?? "").slice(0, 10),
    batch_id: String(r.batch_id ?? ""),
    inserted_at: String(r.inserted_at ?? ""),
    raw: parseRaw(r.raw),
  }));

  if (!rows.length) return null;

  const {
    finalRowsByMonth,
    selectedFinalRows,
    selectedFiscalMonths,
  } = resolveFiscalSelection(rows, args.range);

  const selectedFacts = selectedFinalRows.map((item) =>
    extract48HrFacts(item.row.raw)
  );

  const summaryAgg = aggregateRatio({
    rows: selectedFacts,
    getNumerator: (row) => row.contact_orders_48hr ?? 0,
    getDenominator: (row) => row.eligible_jobs_48hr ?? 0,
  });

  const fallbackRates = selectedFacts
    .map((row) => row.callback_rate_48hr)
    .filter((v): v is number => v != null && Number.isFinite(v));

  const summaryRate =
    summaryAgg.denominator > 0
      ? summaryAgg.value
      : fallbackRates.length > 0
        ? fallbackRates.reduce((sum, value) => sum + value, 0) / fallbackRates.length
        : null;

  const monthFinalMap = new Set(
    selectedFinalRows.map(
      (x) =>
        `${x.row.fiscal_end_date}::${x.row.metric_date}::${x.row.inserted_at}::${x.row.batch_id}`
    )
  );

  const trend = rows
    .filter((r) => selectedFiscalMonths.has(r.fiscal_end_date))
    .map((r) => {
      const facts = extract48HrFacts(r.raw);

      return {
        fiscal_end_date: r.fiscal_end_date,
        metric_date: r.metric_date,
        batch_id: r.batch_id,
        inserted_at: r.inserted_at,
        contact_orders_48hr: facts.contact_orders_48hr,
        eligible_jobs_48hr: facts.eligible_jobs_48hr,
        callback_rate_48hr: facts.callback_rate_48hr,
        kpi_value: facts.callback_rate_48hr,
        is_month_final: monthFinalMap.has(
          `${r.fiscal_end_date}::${r.metric_date}::${r.inserted_at}::${r.batch_id}`
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
      distinct_fiscal_month_count: finalRowsByMonth.length,
      distinct_fiscal_months_found: finalRowsByMonth.map((x) => x.fiscal_end_date),
      selected_month_count: selectedFinalRows.length,
      selected_final_rows: selectedFinalRows.map((x) => {
        const facts = extract48HrFacts(x.row.raw);

        return {
          fiscal_end_date: x.row.fiscal_end_date,
          metric_date: x.row.metric_date,
          batch_id: x.row.batch_id,
          inserted_at: x.row.inserted_at,
          rows_in_month: x.rows_in_month,
          contact_orders_48hr: facts.contact_orders_48hr,
          eligible_jobs_48hr: facts.eligible_jobs_48hr,
          callback_rate_48hr: facts.callback_rate_48hr,
        };
      }),
      trend,
    },
    summary: {
      callback_rate_48hr: summaryRate,
      contact_orders_48hr: summaryAgg.numerator,
      eligible_jobs_48hr: summaryAgg.denominator,
    },
    trend,
  };
}