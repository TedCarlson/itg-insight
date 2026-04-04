// path: src/shared/kpis/engine/resolveCompositeScoresByTech.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { resolveFiscalSelection } from "@/shared/kpis/core/rowSelection";
import type { MetricsRangeKey, RawMetricRow } from "@/shared/kpis/core/types";
import type { ReportClassType } from "./resolveKpiOverrides";

type Args = {
  admin?: ReturnType<typeof supabaseAdmin>;
  techIds: string[];
  pcOrgIds: string[];
  range: MetricsRangeKey;
  class_type?: ReportClassType;
};

type CompositeRow = {
  tech_id: string | null;
  class_type: string | null;
  metric_date: string | null;
  fiscal_end_date: string | null;
  batch_id: string | null;
  created_at: string | null;
  composite_score: number | string | null;
};

function toNum(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function groupCompositeRowsByTech(rows: CompositeRow[]) {
  const map = new Map<string, CompositeRow[]>();

  for (const row of rows) {
    const techId = String(row.tech_id ?? "").trim();
    if (!techId) continue;

    const arr = map.get(techId) ?? [];
    arr.push(row);
    map.set(techId, arr);
  }

  return map;
}

function shiftTodayByMonths(monthsBack: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

function resolveRangeStartDate(range: MetricsRangeKey): string {
  if (range === "FM") return shiftTodayByMonths(0);
  if (range === "PREVIOUS") return shiftTodayByMonths(2);
  if (range === "3FM") return shiftTodayByMonths(3);
  if (range === "12FM") return shiftTodayByMonths(11);
  return "2000-01-01";
}

function resolveCompositeValue(
  rows: CompositeRow[],
  range: MetricsRangeKey
): number | null {
  if (!rows.length) return null;

  const normalizedRows: RawMetricRow[] = rows.map((row) => ({
    metric_date: String(row.metric_date ?? "").slice(0, 10),
    fiscal_end_date: String(row.fiscal_end_date ?? "").slice(0, 10),
    batch_id: String(row.batch_id ?? ""),
    inserted_at: String(row.created_at ?? ""),
    raw: {
      composite_score: toNum(row.composite_score),
    },
  }));

  const { selectedFinalRows } = resolveFiscalSelection(normalizedRows, range);
  const selectedValues = selectedFinalRows
    .map((item) => toNum(item.row.raw?.composite_score))
    .filter((value): value is number => value != null);

  if (!selectedValues.length) return null;

  return selectedValues[0] ?? null;
}

export async function resolveCompositeScoresByTech(
  args: Args
): Promise<Map<string, number | null>> {
  const admin = args.admin ?? supabaseAdmin();
  const { techIds, pcOrgIds, range, class_type } = args;

  const out = new Map<string, number | null>();

  if (!techIds.length || !pcOrgIds.length || !class_type) {
    return out;
  }

  const startDate = resolveRangeStartDate(range);

  const { data, error } = await admin
    .from("ui_master_metric_v2")
    .select(
      "tech_id,class_type,metric_date,fiscal_end_date,batch_id,created_at,composite_score"
    )
    .in("pc_org_id", pcOrgIds)
    .in("tech_id", techIds)
    .eq("class_type", class_type)
    .eq("is_outlier", false)
    .gte("fiscal_end_date", startDate)
    .order("fiscal_end_date", { ascending: false })
    .order("metric_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("batch_id", { ascending: false })
    .limit(10000);

  if (error) {
    throw new Error(
      `resolveCompositeScoresByTech failed loading ui_master_metric_v2: ${error.message}`
    );
  }

  const grouped = groupCompositeRowsByTech((data ?? []) as CompositeRow[]);

  for (const techId of techIds) {
    out.set(techId, resolveCompositeValue(grouped.get(techId) ?? [], range));
  }

  return out;
}