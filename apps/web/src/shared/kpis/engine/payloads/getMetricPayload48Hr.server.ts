// path: apps/web/src/shared/kpis/engine/payloads/getMetricPayload48Hr.server.ts

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { loadMetricScoreRows } from "@/shared/server/metrics/loadMetricScoreRows.server";
import { resolveMetricsRangeBatchIds } from "@/shared/server/metrics/resolveMetricsRangeBatchIds.server";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";

export type GetMetricPayload48HrArgs = {
  person_id: string;
  tech_id: string;
  range: MetricsRangeKey;
};

function toIsoDate(value: unknown): string {
  return String(value ?? "").slice(0, 10);
}

function toNum(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getMetricPayload48Hr(
  args: GetMetricPayload48HrArgs
) {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) return null;

  const rangeResolution = await resolveMetricsRangeBatchIds({
    pc_org_id: scope.selected_pc_org_id,
    range: args.range,
  });

  if (!rangeResolution.batch_ids.length) return null;

  const rawRows = await loadMetricScoreRows({
    pc_org_id: scope.selected_pc_org_id,
    profile_key: "NSR",
    metric_batch_ids: rangeResolution.batch_ids,
  });

  const rows = (rawRows ?? [])
    .filter((row: any) => String(row.tech_id ?? "").trim() === args.tech_id)
    .filter(
      (row: any) =>
        String(row.metric_key ?? "").trim() === "contact_48hr_rate"
    )
    .map((row: any) => ({
      fiscal_end_date: toIsoDate(row.fiscal_end_date),
      metric_date: toIsoDate(row.metric_date),
      batch_id: String(row.metric_batch_id ?? row.batch_id ?? ""),
      inserted_at: String(row.created_at ?? row.inserted_at ?? ""),
      contact_orders_48hr: toNum(row.numerator),
      eligible_jobs_48hr: toNum(row.denominator),
      callback_rate_48hr: toNum(row.metric_value),
      kpi_value: toNum(row.metric_value),
      is_month_final: true,
    }))
    .sort((a, b) => {
      const byFiscal = a.fiscal_end_date.localeCompare(b.fiscal_end_date);
      if (byFiscal !== 0) return byFiscal;

      const byMetric = a.metric_date.localeCompare(b.metric_date);
      if (byMetric !== 0) return byMetric;

      const byInsertedAt = a.inserted_at.localeCompare(b.inserted_at);
      if (byInsertedAt !== 0) return byInsertedAt;

      return a.batch_id.localeCompare(b.batch_id);
    });

  if (!rows.length) return null;

  const latest = rows[rows.length - 1];

  return {
    debug: {
      source: "shared_server_metric_score_rows",
      requested_range: args.range,
      selected_month_count: new Set(rows.map((row) => row.fiscal_end_date)).size,
      trend_count: rows.length,
    },
    summary: {
      callback_rate_48hr: latest.callback_rate_48hr,
      contact_orders_48hr: latest.contact_orders_48hr,
      eligible_jobs_48hr: latest.eligible_jobs_48hr,
    },
    trend: rows,
  };
}