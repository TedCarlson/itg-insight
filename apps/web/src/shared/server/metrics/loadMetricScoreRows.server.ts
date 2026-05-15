// path: apps/web/src/shared/server/metrics/loadMetricScoreRows.server.ts

import { supabaseServer } from "@/shared/data/supabase/server";

export type MetricScoreRow = {
  tech_id: string;
  profile_key: string;
  metric_key: string;
  metric_value: number | null;
  band_key: string | null;
  weighted_points: number | null;
  numerator: number | null;
  denominator: number | null;
  metric_date: string | null;
  fiscal_end_date: string | null;
  created_at: string | null;
  metric_batch_id: string;
};

const PAGE_SIZE = 1000;

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function loadMetricScoreRows(args: {
  pc_org_id: string;
  profile_key: string;
  metric_batch_ids: string[];
}): Promise<MetricScoreRow[]> {
  if (!args.metric_batch_ids.length) return [];

  const sb = await supabaseServer();
  const allRows: any[] = [];

  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await sb
      .from("metric_scores_v")
      .select(
        `
          metric_batch_id,
          metric_date,
          fiscal_end_date,
          created_at,
          tech_id,
          profile_key,
          metric_key,
          metric_value,
          band_key,
          weighted_points,
          numerator,
          denominator
        `
      )
      .eq("profile_key", args.profile_key)
      .in("metric_batch_id", args.metric_batch_ids)
      .order("metric_date", { ascending: true })
      .order("metric_batch_id", { ascending: true })
      .order("tech_id", { ascending: true })
      .order("metric_key", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const page = (data ?? []) as any[];
    allRows.push(...page);

    if (page.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allRows.map((row) => ({
    metric_batch_id: String(row.metric_batch_id),
    metric_date: toNullableString(row.metric_date),
    fiscal_end_date: toNullableString(row.fiscal_end_date),
    created_at: toNullableString(row.created_at),
    tech_id: String(row.tech_id ?? "").trim(),
    profile_key: String(row.profile_key ?? ""),
    metric_key: String(row.metric_key),
    metric_value: toNullableNumber(row.metric_value),
    band_key: toNullableString(row.band_key),
    weighted_points: toNullableNumber(row.weighted_points),
    numerator: toNullableNumber(row.numerator),
    denominator: toNullableNumber(row.denominator),
  }));
}