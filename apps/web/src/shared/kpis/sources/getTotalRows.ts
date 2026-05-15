import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type {
  MetricsTotalRow,
  TotalRowLookupArgs,
} from "@/shared/kpis/contracts/sourceTypes";

type RawTotalRowRecord = {
  id?: string | null;
  batch_id?: string | null;
  pc_org_id?: string | null;
  metric_date?: string | null;
  fiscal_end_date?: string | null;
  summary_type?: string | null;
  summary_key?: string | null;
  summary_label?: string | null;
  unique_row_key?: string | null;
  raw?: Record<string, unknown> | null;
  inserted_at?: string | null;
};

function toMetricsTotalRow(row: RawTotalRowRecord): MetricsTotalRow | null {
  const batch_id = String(row.batch_id ?? "").trim();
  const pc_org_id = String(row.pc_org_id ?? "").trim();
  const metric_date = String(row.metric_date ?? "").trim();
  const fiscal_end_date = String(row.fiscal_end_date ?? "").trim();
  const summary_type = String(row.summary_type ?? "").trim();
  const summary_key = String(row.summary_key ?? "").trim();
  const summary_label = String(row.summary_label ?? "").trim();
  const unique_row_key = String(row.unique_row_key ?? "").trim();

  if (
    !batch_id ||
    !pc_org_id ||
    !metric_date ||
    !fiscal_end_date ||
    !summary_type ||
    !summary_key ||
    !summary_label ||
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
    summary_type,
    summary_key,
    summary_label,
    unique_row_key,
    raw:
      row.raw && typeof row.raw === "object" && !Array.isArray(row.raw)
        ? row.raw
        : {},
    inserted_at: row.inserted_at ? String(row.inserted_at) : undefined,
  };
}

export async function getTotalRows(
  args: TotalRowLookupArgs
): Promise<MetricsTotalRow[]> {
  const admin = supabaseAdmin();

  let query = admin
    .from("metric_pc_org_total_rows_v")
    .select(
      [
        "id",
        "batch_id",
        "pc_org_id",
        "metric_date",
        "fiscal_end_date",
        "summary_type",
        "summary_key",
        "summary_label",
        "unique_row_key",
        "raw",
        "inserted_at",
      ].join(",")
    )
    .eq("pc_org_id", args.pc_org_id)
    .eq("fiscal_end_date", args.fiscal_end_date)
    .eq("summary_type", args.summary_type)
    .order("metric_date", { ascending: false })
    .order("inserted_at", { ascending: false });

  if (args.summary_key) {
    query = query.eq("summary_key", args.summary_key);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`getTotalRows failed: ${error.message}`);
  }

  return ((data ?? []) as RawTotalRowRecord[])
    .map(toMetricsTotalRow)
    .filter((row): row is MetricsTotalRow => row !== null);
}