// path: apps/web/src/shared/server/metrics/resolveMetricsRangeBatchIds.server.ts

import { supabaseServer } from "@/shared/data/supabase/server";
import type {
  MetricsRangeKey,
  MetricsRangeResolution,
  MetricsRangeResolvedBatch,
} from "@/shared/types/metrics/surfacePayload";

type MetricReadyBatchRow = {
  metric_batch_id: string | null;
  metric_date: string | null;
  fiscal_end_date: string | null;
};

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(value: Date, months: number): Date {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function fiscalMonthStart(value: Date): Date {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();

  if (day >= 22) {
    return new Date(Date.UTC(year, month, 22));
  }

  return new Date(Date.UTC(year, month - 1, 22));
}

function fiscalMonthEnd(value: Date): Date {
  return addDays(addMonths(fiscalMonthStart(value), 1), -1);
}

function isFirstWeekOfFiscalMonth(value: Date): boolean {
  const start = fiscalMonthStart(value);
  const diffMs = value.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  return diffDays <= 6;
}

function toResolvedBatch(row: MetricReadyBatchRow | null): MetricsRangeResolvedBatch[] {
  if (!row) return [];

  const metricBatchId = String(row.metric_batch_id ?? "").trim();
  const metricDate = String(row.metric_date ?? "").trim();

  if (!metricBatchId || !metricDate) return [];

  return [
    {
      metric_batch_id: metricBatchId,
      metric_date: metricDate,
      fiscal_end_date: row.fiscal_end_date ?? null,
    },
  ];
}

function dedupeLatestPerFiscalMonthEnd(
  rows: MetricReadyBatchRow[]
): MetricsRangeResolvedBatch[] {
  const map = new Map<string, MetricsRangeResolvedBatch>();

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

async function loadReadyBatchesForDateWindow(args: {
  pc_org_id: string;
  start_date: string;
  end_date: string;
}): Promise<MetricReadyBatchRow[]> {
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("metric_ready_batches_v")
    .select("metric_batch_id, metric_date, fiscal_end_date")
    .eq("pc_org_id", args.pc_org_id)
    .gte("metric_date", args.start_date)
    .lte("metric_date", args.end_date)
    .order("metric_date", { ascending: false })
    .order("metric_batch_id", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MetricReadyBatchRow[];
}

async function loadLatestReadyBatch(
  pc_org_id: string
): Promise<MetricReadyBatchRow | null> {
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("metric_ready_batches_v")
    .select("metric_batch_id, metric_date, fiscal_end_date")
    .eq("pc_org_id", pc_org_id)
    .order("metric_date", { ascending: false })
    .order("metric_batch_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MetricReadyBatchRow | null) ?? null;
}

async function loadLatestReadyBatchForDateWindow(args: {
  pc_org_id: string;
  start_date: string;
  end_date: string;
}): Promise<MetricReadyBatchRow | null> {
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("metric_ready_batches_v")
    .select("metric_batch_id, metric_date, fiscal_end_date")
    .eq("pc_org_id", args.pc_org_id)
    .gte("metric_date", args.start_date)
    .lte("metric_date", args.end_date)
    .order("metric_date", { ascending: false })
    .order("metric_batch_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MetricReadyBatchRow | null) ?? null;
}

export async function resolveMetricsRangeBatchIds(args: {
  pc_org_id: string;
  range: MetricsRangeKey;
}): Promise<MetricsRangeResolution> {
  const latest = await loadLatestReadyBatch(args.pc_org_id);

  if (!latest?.metric_date) {
    return {
      active_range: args.range,
      batch_ids: [],
      batches: [],
      as_of_date: null,
    };
  }

  const anchorDate = parseIsoDate(latest.metric_date);
  const currentStart = fiscalMonthStart(anchorDate);
  const currentEnd = fiscalMonthEnd(anchorDate);

  let batches: MetricsRangeResolvedBatch[] = [];

  if (args.range === "FM") {
    const latestCurrentBatch = await loadLatestReadyBatchForDateWindow({
      pc_org_id: args.pc_org_id,
      start_date: toIsoDate(currentStart),
      end_date: toIsoDate(currentEnd),
    });

    batches = toResolvedBatch(latestCurrentBatch);
  } else if (args.range === "PREVIOUS") {
    const previousAnchor = addDays(currentStart, -1);
    const previousStart = fiscalMonthStart(previousAnchor);
    const previousEnd = fiscalMonthEnd(previousAnchor);

    const latestPreviousBatch = await loadLatestReadyBatchForDateWindow({
      pc_org_id: args.pc_org_id,
      start_date: toIsoDate(previousStart),
      end_date: toIsoDate(previousEnd),
    });

    batches = toResolvedBatch(latestPreviousBatch);
  } else if (args.range === "3FM") {
    const firstWeek = isFirstWeekOfFiscalMonth(anchorDate);

    const rangeStart = firstWeek
      ? fiscalMonthStart(addMonths(currentStart, -3))
      : fiscalMonthStart(addMonths(currentStart, -2));

    const rangeEnd = firstWeek ? addDays(currentStart, -1) : currentEnd;

    const rows = await loadReadyBatchesForDateWindow({
      pc_org_id: args.pc_org_id,
      start_date: toIsoDate(rangeStart),
      end_date: toIsoDate(rangeEnd),
    });

    batches = dedupeLatestPerFiscalMonthEnd(rows);
  } else {
    const rangeStart = fiscalMonthStart(addMonths(currentStart, -12));
    const rangeEnd = addDays(currentStart, -1);

    const rows = await loadReadyBatchesForDateWindow({
      pc_org_id: args.pc_org_id,
      start_date: toIsoDate(rangeStart),
      end_date: toIsoDate(rangeEnd),
    });

    batches = dedupeLatestPerFiscalMonthEnd(rows);
  }

  return {
    active_range: args.range,
    batch_ids: batches.map((row) => row.metric_batch_id),
    batches,
    as_of_date: batches.length ? batches[batches.length - 1].metric_date : null,
  };
}