// path: apps/web/src/shared/kpis/engine/payloads/getOrgMetricPayload.server.ts

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { getTotalRows } from "@/shared/kpis/sources/getTotalRows";
import { resolveMetricsRangeBatchIds } from "@/shared/server/metrics/resolveMetricsRangeBatchIds.server";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";

export type GetOrgMetricPayloadArgs = {
  kpi_key: string;
  range: MetricsRangeKey;
  summary_type?: "pc_org_total";
  summary_key?: string | null;
};

type OrgMetricConfig = {
  title: string;
  valueKey: string;
  numeratorKey: string;
  denominatorKey: string;
  numeratorLabel: string;
  denominatorLabel: string;
  decimals: number;
  sentiment?: "tnps";
};

const ORG_METRIC_CONFIG: Record<string, OrgMetricConfig> = {
  tnps_score: {
    title: "tNPS",
    valueKey: "tNPS Rate",
    numeratorKey: "Promoters",
    denominatorKey: "tNPS Surveys",
    numeratorLabel: "Prom",
    denominatorLabel: "Surveys",
    decimals: 2,
    sentiment: "tnps",
  },
  ftr_rate: {
    title: "FTR %",
    valueKey: "FTR%",
    numeratorKey: "Total FTR/Contact Jobs",
    denominatorKey: "FTRFailJobs",
    numeratorLabel: "Jobs",
    denominatorLabel: "Fails",
    decimals: 1,
  },
  tool_usage_rate: {
    title: "Tool Usage %",
    valueKey: "ToolUsage",
    numeratorKey: "TUResult",
    denominatorKey: "TUEligibleJobs",
    numeratorLabel: "Used",
    denominatorLabel: "Eligible",
    decimals: 1,
  },
  contact_48hr_rate: {
    title: "48Hr Contact",
    valueKey: "48Hr Contact Rate%",
    numeratorKey: "48Hr Contact Orders",
    denominatorKey: "48Hr Eligible Jobs",
    numeratorLabel: "Orders",
    denominatorLabel: "Eligible",
    decimals: 2,
  },
  pht_pure_pass_rate: {
    title: "Pure Pass %",
    valueKey: "PHT Pure Pass%",
    numeratorKey: "PHT Pure Pass",
    denominatorKey: "PHT Jobs",
    numeratorLabel: "Pure Pass",
    denominatorLabel: "PHT Jobs",
    decimals: 1,
  },
  met_rate: {
    title: "MET %",
    valueKey: "MetRate",
    numeratorKey: "TotalMetAppts",
    denominatorKey: "TotalAppts",
    numeratorLabel: "Met",
    denominatorLabel: "Appts",
    decimals: 1,
  },
  repeat_rate: {
    title: "Repeat %",
    valueKey: "Repeat Rate%",
    numeratorKey: "Repeat Count",
    denominatorKey: "TCs",
    numeratorLabel: "Repeats",
    denominatorLabel: "TCs",
    decimals: 1,
  },
  rework_rate: {
    title: "Rework %",
    valueKey: "Rework Rate%",
    numeratorKey: "Rework Count",
    denominatorKey: "Rework Eligible Jobs",
    numeratorLabel: "Rework",
    denominatorLabel: "Eligible",
    decimals: 2,
  },
  soi_rate: {
    title: "SOI %",
    valueKey: "SOI Rate%",
    numeratorKey: "SOI Count",
    denominatorKey: "Installs",
    numeratorLabel: "SOI",
    denominatorLabel: "Installs",
    decimals: 1,
  },
};

function toNum(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtNum(value: number | null | undefined, decimals: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(decimals);
}

function fmtInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

function mapRangeLabel(activeRange: MetricsRangeKey): string {
  if (activeRange === "FM") return "Current FM";
  if (activeRange === "PREVIOUS") return "Previous FM";
  if (activeRange === "3FM") return "Last 3 FM";
  if (activeRange === "12FM") return "Last 12 FM";
  return String(activeRange);
}

export async function getOrgMetricPayload(args: GetOrgMetricPayloadArgs) {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) return null;

  const config = ORG_METRIC_CONFIG[args.kpi_key];
  if (!config) return null;

  const rangeResolution = await resolveMetricsRangeBatchIds({
    pc_org_id: scope.selected_pc_org_id,
    range: args.range,
    mode: "inspection",
  });

  const latestResolvedBatch =
    rangeResolution.batches[rangeResolution.batches.length - 1] ?? null;

  const fiscalEndDate = latestResolvedBatch?.fiscal_end_date ?? null;
  if (!fiscalEndDate) return null;

  const rows = await getTotalRows({
    pc_org_id: scope.selected_pc_org_id,
    fiscal_end_date: fiscalEndDate,
    summary_type: args.summary_type ?? "pc_org_total",
    summary_key: args.summary_key ?? scope.selected_pc_org_id,
  });

  const trendRows = rows
    .map((row) => {
      const value = toNum(row.raw[config.valueKey]);
      const numerator = toNum(row.raw[config.numeratorKey]);
      const denominator = toNum(row.raw[config.denominatorKey]);
      const promoters = toNum(row.raw.Promoters);
      const detractors = toNum(row.raw.Detractors);
      const surveys = toNum(row.raw["tNPS Surveys"]);

      return {
        fiscal_end_date: row.fiscal_end_date,
        metric_date: row.metric_date,
        batch_id: row.batch_id,
        inserted_at: row.inserted_at ?? "",
        kpi_value: value,
        numerator,
        denominator,
        promoters,
        detractors,
        surveys,
        is_month_final: row.metric_date === row.fiscal_end_date,
      };
    })
    .sort((a, b) => {
      const byMetric = a.metric_date.localeCompare(b.metric_date);
      if (byMetric !== 0) return byMetric;

      const byInserted = a.inserted_at.localeCompare(b.inserted_at);
      if (byInserted !== 0) return byInserted;

      return a.batch_id.localeCompare(b.batch_id);
    });

  if (!trendRows.length) return null;

  const latest = trendRows[trendRows.length - 1];

  const trendPoints = trendRows.map((row) => ({
    kpi_value: row.kpi_value,
    is_month_final: row.is_month_final,
    band_color: null,
  }));

  const periodRows = trendRows.map((row) => ({
    key: `${row.metric_date}-${row.batch_id}`,
    cells: [
      row.metric_date,
      fmtNum(row.kpi_value, config.decimals),
      fmtInt(row.numerator),
      fmtInt(row.denominator),
      ...(config.sentiment === "tnps" ? [fmtInt(row.detractors)] : []),
    ],
  }));

  const totalSurveys = latest.surveys ?? 0;
  const totalPromoters = latest.promoters ?? 0;
  const totalDetractors = latest.detractors ?? 0;

  return {
    summary_rows: [],
    source_payload: {
      debug: {
        source: "metric_pc_org_total_rows_v",
        requested_range: args.range,
        selected_pc_org_id: scope.selected_pc_org_id,
        fiscal_end_date: fiscalEndDate,
        summary_type: args.summary_type ?? "pc_org_total",
        summary_key: args.summary_key ?? scope.selected_pc_org_id,
        trend_count: trendRows.length,
        selected_month_count: new Set(
          trendRows.map((row) => row.fiscal_end_date)
        ).size,
      },
      summary: {
        value: latest.kpi_value,
        numerator: latest.numerator,
        denominator: latest.denominator,
        promoters: latest.promoters,
        detractors: latest.detractors,
        surveys: latest.surveys,
      },
      trend: trendRows,
    },
    render_model: {
      header: {
        title: config.title,
        valueDisplay: fmtNum(latest.kpi_value, config.decimals),
        rangeLabel: mapRangeLabel(args.range),
      },
      sentiment:
        config.sentiment === "tnps"
          ? {
            kind: "tnps_sentiment",
            totalSurveys,
            totalPromoters,
            totalDetractors,
            title: "Sentiment Mix",
          }
          : undefined,
      trend: {
        title: "Trend",
        subtitle: "Checkpoint progression in selected window",
        badgeValue: fmtNum(latest.kpi_value, config.decimals),
        currentValue: fmtNum(latest.kpi_value, config.decimals),
        updatesCount: trendRows.length,
        monthsCount: new Set(trendRows.map((row) => row.fiscal_end_date)).size,
        rangeLabel: mapRangeLabel(args.range),
        points: trendPoints,
      },
      periodDetail: {
        title: "Period Detail",
        columns: [
          { key: "metric_date", label: "Metric Date" },
          {
            key: "value",
            label: config.title,
            align: "right",
            widthClass: "w-[90px]",
          },
          {
            key: "numerator",
            label: config.numeratorLabel,
            align: "right",
            widthClass: "w-[90px]",
          },
          {
            key: "denominator",
            label: config.denominatorLabel,
            align: "right",
            widthClass: "w-[90px]",
          },
          ...(config.sentiment === "tnps"
            ? [
              {
                key: "detractors",
                label: "Detr",
                align: "right",
                widthClass: "w-[80px]",
              },
            ]
            : []),
        ],
        rows: periodRows,
        footer: {
          key: "footer",
          cells: [
            "TOTAL",
            fmtNum(latest.kpi_value, config.decimals),
            fmtInt(latest.numerator),
            fmtInt(latest.denominator),
            ...(config.sentiment === "tnps" ? [fmtInt(latest.detractors)] : []),
          ],
        },
      },
    },
  };
}