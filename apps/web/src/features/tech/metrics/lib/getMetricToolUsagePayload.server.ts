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

function pickEligible(raw: Record<string, unknown>) {
  return pickNum(raw, [
    "TUEligibleJobs",
    "tu_eligible_jobs",
    "TU Eligible Jobs",
  ]);
}

function pickCompliant(raw: Record<string, unknown>) {
  return pickNum(raw, [
    "TUResult",
    "tu_result",
    "TU Result",
    "tu_compliant_jobs",
  ]);
}

function pickDirectRate(raw: Record<string, unknown>) {
  return pickNum(raw, [
    "ToolUsage",
    "ToolUsage%",
    "Tool Usage",
    "Tool Usage%",
    "tool_usage_rate",
    "tool_usage",
  ]);
}

function extractToolUsageFacts(raw: Record<string, unknown>) {
  const eligible = pickEligible(raw);
  const compliant = pickCompliant(raw);
  const directRate = pickDirectRate(raw);

  const agg = aggregateRatio({
    rows: [{ eligible, compliant }],
    getNumerator: (row) => row.compliant ?? 0,
    getDenominator: (row) => row.eligible ?? 0,
  });

  return {
    tu_eligible_jobs: eligible,
    tu_compliant_jobs: compliant,
    tool_usage_rate: agg.denominator > 0 ? agg.value : directRate,
    usesFacts: agg.denominator > 0,
  };
}

export async function getMetricToolUsagePayload(args: Args) {
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
    throw new Error(`getMetricToolUsagePayload failed: ${error.message}`);
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
    extractToolUsageFacts(item.row.raw)
  );

  const summaryAgg = aggregateRatio({
    rows: selectedFacts,
    getNumerator: (row) => row.tu_compliant_jobs ?? 0,
    getDenominator: (row) => row.tu_eligible_jobs ?? 0,
  });

  const fallbackRates = selectedFacts
    .map((row) => row.tool_usage_rate)
    .filter((v): v is number => v != null && Number.isFinite(v));

  const summaryToolUsage =
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
      const facts = extractToolUsageFacts(r.raw);

      return {
        fiscal_end_date: r.fiscal_end_date,
        metric_date: r.metric_date,
        batch_id: r.batch_id,
        inserted_at: r.inserted_at,
        tu_eligible_jobs: facts.tu_eligible_jobs,
        tu_compliant_jobs: facts.tu_compliant_jobs,
        tool_usage_rate: facts.tool_usage_rate,
        kpi_value: facts.tool_usage_rate,
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
        const facts = extractToolUsageFacts(x.row.raw);

        return {
          fiscal_end_date: x.row.fiscal_end_date,
          metric_date: x.row.metric_date,
          batch_id: x.row.batch_id,
          inserted_at: x.row.inserted_at,
          rows_in_month: x.rows_in_month,
          tu_eligible_jobs: facts.tu_eligible_jobs,
          tu_compliant_jobs: facts.tu_compliant_jobs,
          tool_usage_rate: facts.tool_usage_rate,
        };
      }),
      trend,
    },
    summary: {
      tool_usage_rate: summaryToolUsage,
      tu_eligible_jobs: summaryAgg.denominator,
      tu_compliant_jobs: summaryAgg.numerator,
    },
    trend,
  };
}