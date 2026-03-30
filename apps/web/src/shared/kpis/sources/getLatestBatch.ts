import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type {
  LatestBatchLookupArgs,
  MetricsBatchRef,
} from "@/shared/kpis/contracts/sourceTypes";

type RawBatchRecord = {
  batch_id?: string | null;
  pc_org_id?: string | null;
  metric_date?: string | null;
  fiscal_end_date?: string | null;
};

function toMetricsBatchRef(row: RawBatchRecord): MetricsBatchRef | null {
  const batch_id = String(row.batch_id ?? "").trim();
  const pc_org_id = String(row.pc_org_id ?? "").trim();
  const metric_date = String(row.metric_date ?? "").trim();
  const fiscal_end_date = String(row.fiscal_end_date ?? "").trim();

  if (!batch_id || !pc_org_id || !metric_date || !fiscal_end_date) {
    return null;
  }

  return {
    batch_id,
    pc_org_id,
    metric_date,
    fiscal_end_date,
  };
}

export async function getLatestBatch(
  args: LatestBatchLookupArgs
): Promise<MetricsBatchRef | null> {
  const admin = supabaseAdmin();

  let query = admin
    .from("metrics_raw_batch")
    .select(
      [
        "batch_id",
        "pc_org_id",
        "metric_date",
        "fiscal_end_date",
      ].join(",")
    )
    .eq("pc_org_id", args.pc_org_id)
    .order("metric_date", { ascending: false })
    .limit(1);

  if (args.fiscal_end_date) {
    query = query.eq("fiscal_end_date", args.fiscal_end_date);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`getLatestBatch failed: ${error.message}`);
  }

  const row = (data ?? [])[0] as RawBatchRecord | undefined;
  if (!row) return null;

  return toMetricsBatchRef(row);
}