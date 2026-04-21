// path: apps/web/src/shared/kpis/engine/payloads/getMetricPayloadToolUsage.server.ts

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { loadMetricScoreRows } from "@/shared/server/metrics/loadMetricScoreRows.server";
import { resolveMetricsRangeBatchIds } from "@/shared/server/metrics/resolveMetricsRangeBatchIds.server";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";

export type GetMetricPayloadToolUsageArgs = {
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

export async function getMetricPayloadToolUsage(
  args: GetMetricPayloadToolUsageArgs
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
      (row: any) => String(row.metric_key ?? "").trim() === "tool_usage_rate"
    )
    .map((row: any) => ({
      fiscal_end_date: toIsoDate(row.fiscal_end_date),
      metric_date: toIsoDate(row.metric_date),
      batch_id: String(row.metric_batch_id ?? row.batch_id ?? ""),
      inserted_at: String(row.created_at ?? row.inserted_at ?? ""),
      tu_eligible_jobs: toNum(row.denominator),
      tu_compliant_jobs: toNum(row.numerator),
      tool_usage_rate: toNum(row.metric_value),
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
      tool_usage_rate: latest.tool_usage_rate,
      tu_eligible_jobs: latest.tu_eligible_jobs,
      tu_compliant_jobs: latest.tu_compliant_jobs,
    },
    trend: rows,
  };
}