import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type LoadedKpiRubricRow = {
  band_key: "EXCEEDS" | "MEETS" | "NEEDS_IMPROVEMENT" | "MISSES" | "NO_DATA";
  min_value: number | null;
  max_value: number | null;
};

type RubricRow = {
  kpi_key?: string | null;
  band_key?: string | null;
  min_value?: number | null;
  max_value?: number | null;
};

export async function loadKpiRubric(args: {
  kpi_keys: string[];
}): Promise<Map<string, LoadedKpiRubricRow[]>> {
  const out = new Map<string, LoadedKpiRubricRow[]>();

  if (!args.kpi_keys.length) {
    return out;
  }

  const admin = supabaseAdmin();

  const { data } = await admin
    .from("metrics_kpi_rubric")
    .select("kpi_key,band_key,min_value,max_value")
    .or("is_active.is.null,is_active.eq.true")
    .in("kpi_key", args.kpi_keys);

  for (const row of (data ?? []) as RubricRow[]) {
    const kpi_key = String(row.kpi_key ?? "").trim();
    const band_key = String(row.band_key ?? "").trim();

    if (!kpi_key || !band_key) continue;

    const bucket = out.get(kpi_key) ?? [];
    bucket.push({
      band_key: band_key as LoadedKpiRubricRow["band_key"],
      min_value:
        typeof row.min_value === "number" && Number.isFinite(row.min_value)
          ? row.min_value
          : null,
      max_value:
        typeof row.max_value === "number" && Number.isFinite(row.max_value)
          ? row.max_value
          : null,
    });
    out.set(kpi_key, bucket);
  }

  return out;
}