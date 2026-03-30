import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { resolveFiscalSelection } from "@/shared/kpis/core/rowSelection";
import type { RawMetricRow } from "@/shared/kpis/core/types";
import type { RangeKey } from "./resolveKpiOverrides";

type OrgMetricRow = RawMetricRow & {
  tech_id: string;
};

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

function groupRowsByTech(rows: OrgMetricRow[]) {
  const map = new Map<string, OrgMetricRow[]>();

  for (const row of rows) {
    const techId = String(row.tech_id ?? "").trim();
    if (!techId) continue;

    const bucket = map.get(techId) ?? [];
    bucket.push(row);
    map.set(techId, bucket);
  }

  return map;
}

export async function resolveOrgMetricFacts(args: {
  admin?: ReturnType<typeof supabaseAdmin>;
  pcOrgIds: string[];
  range: RangeKey;
}): Promise<Record<string, unknown>[]> {
  const admin = args.admin ?? supabaseAdmin();

  if (!args.pcOrgIds.length) {
    return [];
  }

  const { data, error } = await admin
    .from("metrics_raw_row")
    .select("tech_id,metric_date,fiscal_end_date,batch_id,inserted_at,raw")
    .in("pc_org_id", args.pcOrgIds)
    .order("fiscal_end_date", { ascending: false })
    .order("metric_date", { ascending: false })
    .order("inserted_at", { ascending: false })
    .order("batch_id", { ascending: false })
    .limit(20000);

  if (error) {
    throw new Error(`resolveOrgMetricFacts failed: ${error.message}`);
  }

  const rows: OrgMetricRow[] = (data ?? []).map((row: any) => ({
    tech_id: String(row.tech_id ?? ""),
    metric_date: String(row.metric_date ?? "").slice(0, 10),
    fiscal_end_date: String(row.fiscal_end_date ?? "").slice(0, 10),
    batch_id: String(row.batch_id ?? ""),
    inserted_at: String(row.inserted_at ?? ""),
    raw: parseRaw(row.raw),
  }));

  const rowsByTech = groupRowsByTech(rows);
  const out: Record<string, unknown>[] = [];

  for (const techRows of rowsByTech.values()) {
    const { selectedFinalRows } = resolveFiscalSelection(
      techRows as RawMetricRow[],
      args.range
    );

    for (const entry of selectedFinalRows) {
      out.push(entry.row.raw);
    }
  }

  return out;
}