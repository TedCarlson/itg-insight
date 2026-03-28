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

function pickSoiCount(raw: Record<string, unknown>) {
  return pickNum(raw, ["SOI Count", "soi_count", "SOICount"]);
}

function pickInstalls(raw: Record<string, unknown>) {
  return pickNum(raw, ["Installs", "installs", "install_count"]);
}

function pickDirectRate(raw: Record<string, unknown>) {
  return pickNum(raw, ["SOI Rate%", "SOI Rate %", "soi_rate", "soi_rate_pct"]);
}

function extractSoiFacts(raw: Record<string, unknown>) {
  const installs = pickInstalls(raw);
  const soiCount = pickSoiCount(raw);
  const directRate = pickDirectRate(raw);

  const agg = aggregateRatio({
    rows: [{ installs, soiCount }],
    getNumerator: (row) => row.soiCount ?? 0,
    getDenominator: (row) => row.installs ?? 0,
  });

  return {
    soi_count: soiCount,
    installs,
    soi_rate: agg.denominator > 0 ? agg.value : directRate,
    usesFacts: agg.denominator > 0,
  };
}

export async function getMetricSoiPayload(args: Args) {
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
    throw new Error(`getMetricSoiPayload failed: ${error.message}`);
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
    extractSoiFacts(item.row.raw)
  );

  const summaryAgg = aggregateRatio({
    rows: selectedFacts,
    getNumerator: (row) => row.soi_count ?? 0,
    getDenominator: (row) => row.installs ?? 0,
  });

  const fallbackRates = selectedFacts
    .map((row) => row.soi_rate)
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
      const facts = extractSoiFacts(r.raw);

      return {
        fiscal_end_date: r.fiscal_end_date,
        metric_date: r.metric_date,
        batch_id: r.batch_id,
        inserted_at: r.inserted_at,
        soi_count: facts.soi_count,
        installs: facts.installs,
        soi_rate: facts.soi_rate,
        kpi_value: facts.soi_rate,
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
        const facts = extractSoiFacts(x.row.raw);

        return {
          fiscal_end_date: x.row.fiscal_end_date,
          metric_date: x.row.metric_date,
          batch_id: x.row.batch_id,
          inserted_at: x.row.inserted_at,
          rows_in_month: x.rows_in_month,
          soi_count: facts.soi_count,
          installs: facts.installs,
          soi_rate: facts.soi_rate,
        };
      }),
      trend,
    },
    summary: {
      soi_rate: summaryRate,
      soi_count: summaryAgg.numerator,
      installs: summaryAgg.denominator,
    },
    trend,
  };
}