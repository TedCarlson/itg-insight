// path: apps/web/src/shared/server/metrics/loadMetricCompositeRows.server.ts

import { supabaseServer } from "@/shared/data/supabase/server";

export type MetricCompositeRow = {
  tech_id: string;
  full_name: string | null;
  composite_score: number | null;
  rank_in_profile: number | null;
  metric_date: string | null;
  metric_batch_id: string;
  office_label: string | null;
  affiliation_type: string | null;
  reports_to_person_id: string | null;
  co_code: string | null;
};

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function loadMetricCompositeRows(args: {
  pc_org_id: string;
  profile_key: string;
  metric_batch_ids: string[];
}): Promise<MetricCompositeRow[]> {
  if (!args.metric_batch_ids.length) return [];

  const sb = await supabaseServer();

  const [compositeRes, rankRes, subjectRes] = await Promise.all([
    sb
      .from("metric_profile_composites_v")
      .select(
        `
          metric_batch_id,
          metric_date,
          tech_id,
          composite_score
        `
      )
      .eq("profile_key", args.profile_key)
      .in("metric_batch_id", args.metric_batch_ids),

    sb
      .from("metric_profile_ranks_v")
      .select(
        `
          metric_batch_id,
          tech_id,
          rank_in_profile
        `
      )
      .eq("profile_key", args.profile_key)
      .in("metric_batch_id", args.metric_batch_ids),

    sb
      .from("metric_subject_composites_v")
      .select(
        `
          metric_batch_id,
          tech_id,
          full_name,
          office_label,
          affiliation_type,
          reports_to_person_id,
          co_code
        `
      )
      .eq("profile_key", args.profile_key)
      .in("metric_batch_id", args.metric_batch_ids),
  ]);

  if (compositeRes.error) {
    throw new Error(compositeRes.error.message);
  }

  if (rankRes.error) {
    throw new Error(rankRes.error.message);
  }

  if (subjectRes.error) {
    throw new Error(subjectRes.error.message);
  }

  const composites = (compositeRes.data ?? []) as any[];
  const ranks = (rankRes.data ?? []) as any[];
  const subjects = (subjectRes.data ?? []) as any[];

  const rankByKey = new Map<string, number | null>();
  for (const row of ranks) {
    const key = `${String(row.metric_batch_id)}::${String(row.tech_id ?? "").trim()}`;
    rankByKey.set(key, toNullableNumber(row.rank_in_profile));
  }

  const subjectByKey = new Map<
    string,
    {
      full_name: string | null;
      office_label: string | null;
      affiliation_type: string | null;
      reports_to_person_id: string | null;
      co_code: string | null;
    }
  >();

  for (const row of subjects) {
    const techId = String(row.tech_id ?? "").trim();
    if (!techId) continue;

    const key = `${String(row.metric_batch_id)}::${techId}`;
    if (subjectByKey.has(key)) continue;

    subjectByKey.set(key, {
      full_name: toNullableString(row.full_name),
      office_label: toNullableString(row.office_label),
      affiliation_type: toNullableString(row.affiliation_type),
      reports_to_person_id: toNullableString(row.reports_to_person_id),
      co_code: toNullableString(row.co_code),
    });
  }

  return composites
    .map((row) => {
      const techId = String(row.tech_id ?? "").trim();
      const key = `${String(row.metric_batch_id)}::${techId}`;
      const subject = subjectByKey.get(key);

      return {
        metric_batch_id: String(row.metric_batch_id),
        metric_date: toNullableString(row.metric_date),
        tech_id: techId,
        full_name: subject?.full_name ?? null,
        composite_score: toNullableNumber(row.composite_score),
        rank_in_profile: rankByKey.get(key) ?? null,
        office_label: subject?.office_label ?? null,
        affiliation_type: subject?.affiliation_type ?? null,
        reports_to_person_id: subject?.reports_to_person_id ?? null,
        co_code: subject?.co_code ?? null,
      };
    })
    .filter((row) => Boolean(row.tech_id))
    .sort((a, b) => {
      const rankA =
        typeof a.rank_in_profile === "number" ? a.rank_in_profile : 999999;
      const rankB =
        typeof b.rank_in_profile === "number" ? b.rank_in_profile : 999999;
      if (rankA !== rankB) return rankA - rankB;
      return String(a.full_name ?? "").localeCompare(String(b.full_name ?? ""));
    });
}