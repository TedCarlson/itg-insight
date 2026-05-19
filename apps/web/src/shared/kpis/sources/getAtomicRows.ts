import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type {
  AtomicRowLookupArgs,
  MetricsAtomicRow,
} from "@/shared/kpis/contracts/sourceTypes";

type RawAtomicRowRecord = {
  id?: string | null;
  batch_id?: string | null;
  pc_org_id?: string | null;
  metric_date?: string | null;
  fiscal_end_date?: string | null;
  tech_id?: string | null;
  unique_row_key?: string | null;
  raw?: Record<string, unknown> | null;
  inserted_at?: string | null;
};

function toMetricsAtomicRow(row: RawAtomicRowRecord): MetricsAtomicRow | null {
  const batch_id = String(row.batch_id ?? "").trim();
  const pc_org_id = String(row.pc_org_id ?? "").trim();
  const metric_date = String(row.metric_date ?? "").trim();
  const fiscal_end_date = String(row.fiscal_end_date ?? "").trim();
  const tech_id = String(row.tech_id ?? "").trim();
  const unique_row_key = String(row.unique_row_key ?? "").trim();

  if (
    !batch_id ||
    !pc_org_id ||
    !metric_date ||
    !fiscal_end_date ||
    !tech_id ||
    !unique_row_key
  ) {
    return null;
  }

  return {
    id: row.id ? String(row.id) : undefined,
    batch_id,
    pc_org_id,
    metric_date,
    fiscal_end_date,
    tech_id,
    unique_row_key,
    raw:
      row.raw && typeof row.raw === "object" && !Array.isArray(row.raw)
        ? row.raw
        : {},
    inserted_at: row.inserted_at ? String(row.inserted_at) : undefined,
  };
}

export async function getAtomicRows(
  args: AtomicRowLookupArgs
): Promise<MetricsAtomicRow[]> {
  const admin = supabaseAdmin();

  let query = admin
    .from("metric_raw_rows_compat_v")
    .select(
      [
        "id",
        "batch_id",
        "pc_org_id",
        "metric_date",
        "fiscal_end_date",
        "tech_id",
        "unique_row_key",
        "raw",
        "inserted_at",
      ].join(",")
    )
    .eq("pc_org_id", args.pc_org_id)
    .eq("fiscal_end_date", args.fiscal_end_date)
    .order("metric_date", { ascending: false })
    .order("inserted_at", { ascending: false });

  if (args.tech_ids && args.tech_ids.length > 0) {
    query = query.in("tech_id", args.tech_ids);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`getAtomicRows failed: ${error.message}`);
  }

  return ((data ?? []) as RawAtomicRowRecord[])
    .map(toMetricsAtomicRow)
    .filter((row): row is MetricsAtomicRow => row !== null);
}