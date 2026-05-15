// path: apps/web/src/shared/kpis/engine/payloads/getMetricPayloadTnps.server.ts

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { loadMetricScoreRows } from "@/shared/server/metrics/loadMetricScoreRows.server";
import { resolveMetricsRangeBatchIds } from "@/shared/server/metrics/resolveMetricsRangeBatchIds.server";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";

export type GetMetricPayloadTnpsArgs = {
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

function deriveTnpsCounts(row: any): {
  surveys: number | null;
  promoters: number | null;
  detractors: number | null;
} {
  const promoters = toNum(row.numerator);
  const surveys = toNum(row.denominator);
  const tnpsScore = toNum(row.metric_value);

  if (surveys == null || promoters == null || surveys <= 0 || tnpsScore == null) {
    return {
      surveys,
      promoters,
      detractors: null,
    };
  }

  const detractors = Math.round(promoters - (tnpsScore / 100) * surveys);

  return {
    surveys,
    promoters,
    detractors: Math.max(0, detractors),
  };
}

export async function getMetricPayloadTnps(args: GetMetricPayloadTnpsArgs) {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) return null;

  const rangeResolution = await resolveMetricsRangeBatchIds({
    pc_org_id: scope.selected_pc_org_id,
    range: args.range,
    mode: "inspection",
  });

  if (!rangeResolution.batch_ids.length) return null;

  const rawRows = await loadMetricScoreRows({
    pc_org_id: scope.selected_pc_org_id,
    profile_key: "NSR",
    metric_batch_ids: rangeResolution.batch_ids,
  });

  const tnpsRows = (rawRows ?? [])
    .filter((row: any) => String(row.tech_id ?? "").trim() === args.tech_id)
    .filter((row: any) => String(row.metric_key ?? "").trim() === "tnps_score")
    .map((row: any) => {
      const counts = deriveTnpsCounts(row);

      return {
        fiscal_end_date: toIsoDate(row.fiscal_end_date),
        metric_date: toIsoDate(row.metric_date),
        batch_id: String(row.metric_batch_id ?? row.batch_id ?? ""),
        inserted_at: String(row.created_at ?? row.inserted_at ?? ""),
        kpi_value: toNum(row.metric_value),
        tnps_surveys: counts.surveys,
        tnps_promoters: counts.promoters,
        tnps_detractors: counts.detractors,
        is_month_final:
          String(row.metric_date ?? "").slice(0, 10) ===
          String(row.fiscal_end_date ?? "").slice(0, 10),
      };
    })
    .sort((a, b) => {
      const byFiscal = a.fiscal_end_date.localeCompare(b.fiscal_end_date);
      if (byFiscal !== 0) return byFiscal;

      const byMetric = a.metric_date.localeCompare(b.metric_date);
      if (byMetric !== 0) return byMetric;

      const byInsertedAt = a.inserted_at.localeCompare(b.inserted_at);
      if (byInsertedAt !== 0) return byInsertedAt;

      return a.batch_id.localeCompare(b.batch_id);
    });

  if (!tnpsRows.length) return null;

  const latest = tnpsRows[tnpsRows.length - 1];

  return {
    debug: {
      source: "shared_server_metric_score_rows",
      requested_range: args.range,
      selected_pc_org_id: scope.selected_pc_org_id,

      batch_count: rangeResolution.batch_ids.length,
      batch_ids: rangeResolution.batch_ids,
      resolved_batches: rangeResolution.batches,

      raw_row_count: rawRows?.length ?? 0,

      trend_count: tnpsRows.length,
      selected_month_count: new Set(tnpsRows.map((row) => row.fiscal_end_date))
        .size,

      tnps_batch_ids: tnpsRows.map((row) => row.batch_id),
      tnps_metric_dates: tnpsRows.map((row) => row.metric_date),
    },
    summary: {
      tnps_score: latest.kpi_value,
      tnps_surveys: latest.tnps_surveys,
      tnps_promoters: latest.tnps_promoters,
      tnps_detractors: latest.tnps_detractors,
    },
    trend: tnpsRows,
  };
}