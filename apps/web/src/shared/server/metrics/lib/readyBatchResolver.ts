// path: apps/web/src/shared/server/metrics/lib/readyBatchResolver.ts

import { supabaseServer } from "@/shared/data/supabase/server";
import {
  addDays,
  addMonths,
  fiscalMonthEnd,
  fiscalMonthStart,
  isFirstWeekOfFiscalMonth,
  parseIsoDate,
  toIsoDate,
} from "@/shared/domain/time/fiscalCalendar";
import type { MetricsRangeKey } from "@/shared/types/metrics/surfacePayload";

type MetricReadyBatchRow = {
  metric_batch_id: string | null;
  metric_date: string | null;
  fiscal_end_date: string | null;
  created_at?: string | null;
};

export function dedupeLatestPerMetricDate(
  rows: MetricReadyBatchRow[]
): Array<{
  metric_batch_id: string;
  metric_date: string;
  fiscal_end_date: string | null;
}> {
  const map = new Map<
    string,
    {
      metric_batch_id: string;
      metric_date: string;
      fiscal_end_date: string | null;
    }
  >();

  for (const row of rows) {
    const metricDate = String(row.metric_date ?? "").trim();
    const metricBatchId = String(row.metric_batch_id ?? "").trim();
    if (!metricDate || !metricBatchId) continue;
    if (map.has(metricDate)) continue;

    map.set(metricDate, {
      metric_batch_id: metricBatchId,
      metric_date: metricDate,
      fiscal_end_date: row.fiscal_end_date ?? null,
    });
  }

  return [...map.values()].sort((a, b) => a.metric_date.localeCompare(b.metric_date));
}

export function dedupeLatestPerFiscalMonthEnd(
  rows: MetricReadyBatchRow[]
): Array<{
  metric_batch_id: string;
  metric_date: string;
  fiscal_end_date: string | null;
}> {
  const map = new Map<
    string,
    {
      metric_batch_id: string;
      metric_date: string;
      fiscal_end_date: string | null;
    }
  >();

  for (const row of rows) {
    const metricDate = String(row.metric_date ?? "").trim();
    const fiscalEndDate = String(row.fiscal_end_date ?? "").trim();
    const metricBatchId = String(row.metric_batch_id ?? "").trim();

    if (!metricDate || !fiscalEndDate || !metricBatchId) continue;
    if (metricDate !== fiscalEndDate) continue;
    if (map.has(fiscalEndDate)) continue;

    map.set(fiscalEndDate, {
      metric_batch_id: metricBatchId,
      metric_date: metricDate,
      fiscal_end_date: fiscalEndDate,
    });
  }

  return [...map.values()].sort((a, b) => a.metric_date.localeCompare(b.metric_date));
}

export function buildComparisonWindow(args: {
  range: MetricsRangeKey;
  latestMetricDate: string;
}) {
  const anchorDate = parseIsoDate(args.latestMetricDate);
  const currentFiscalStart = fiscalMonthStart(anchorDate);
  const firstWeek = isFirstWeekOfFiscalMonth(anchorDate);

  let selectedStart: Date;
  let comparisonStart: Date;
  let comparisonEnd: Date;
  let dedupeMode: "metric_date" | "fiscal_month_end";

  if (args.range === "FM") {
    selectedStart = currentFiscalStart;
    comparisonStart = fiscalMonthStart(addDays(selectedStart, -1));
    comparisonEnd = fiscalMonthEnd(addDays(selectedStart, -1));
    dedupeMode = "metric_date";
  } else if (args.range === "PREVIOUS") {
    selectedStart = fiscalMonthStart(addMonths(currentFiscalStart, -1));
    comparisonStart = fiscalMonthStart(addDays(selectedStart, -1));
    comparisonEnd = fiscalMonthEnd(addDays(selectedStart, -1));
    dedupeMode = "metric_date";
  } else if (args.range === "3FM") {
    selectedStart = firstWeek
      ? fiscalMonthStart(addMonths(currentFiscalStart, -3))
      : fiscalMonthStart(addMonths(currentFiscalStart, -2));
    comparisonStart = fiscalMonthStart(addMonths(selectedStart, -3));
    comparisonEnd = addDays(selectedStart, -1);
    dedupeMode = "metric_date";
  } else {
    selectedStart = fiscalMonthStart(addMonths(currentFiscalStart, -12));
    comparisonStart = fiscalMonthStart(addMonths(selectedStart, -12));
    comparisonEnd = addDays(selectedStart, -1);
    dedupeMode = "fiscal_month_end";
  }

  return {
    start_date: toIsoDate(comparisonStart),
    end_date: toIsoDate(comparisonEnd),
    dedupeMode,
  };
}

export async function loadLatestReadyBatch(
  pc_org_id: string
): Promise<MetricReadyBatchRow | null> {
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("metric_ready_batches_v")
    .select("metric_batch_id, metric_date, fiscal_end_date, created_at")
    .eq("pc_org_id", pc_org_id)
    .order("metric_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MetricReadyBatchRow | null) ?? null;
}

export async function loadReadyBatchesForDateWindow(args: {
  pc_org_id: string;
  start_date: string;
  end_date: string;
}): Promise<MetricReadyBatchRow[]> {
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("metric_ready_batches_v")
    .select("metric_batch_id, metric_date, fiscal_end_date, created_at")
    .eq("pc_org_id", args.pc_org_id)
    .gte("metric_date", args.start_date)
    .lte("metric_date", args.end_date)
    .order("metric_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MetricReadyBatchRow[];
}

export async function resolveComparisonBatchIds(args: {
  pc_org_id: string;
  range: MetricsRangeKey;
}): Promise<string[]> {
  const latest = await loadLatestReadyBatch(args.pc_org_id);

  if (!latest?.metric_date) {
    return [];
  }

  const comparisonWindow = buildComparisonWindow({
    range: args.range,
    latestMetricDate: latest.metric_date,
  });

  const rows = await loadReadyBatchesForDateWindow({
    pc_org_id: args.pc_org_id,
    start_date: comparisonWindow.start_date,
    end_date: comparisonWindow.end_date,
  });

  const deduped =
    comparisonWindow.dedupeMode === "fiscal_month_end"
      ? dedupeLatestPerFiscalMonthEnd(rows)
      : dedupeLatestPerMetricDate(rows);

  return deduped.map((row) => row.metric_batch_id);
}