import type { InspectionRenderModel } from "@/shared/kpis/contracts/inspectionTypes";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";
import { aggregateTnps } from "@/shared/kpis/core/aggregateTnps";

function fmtNum(value: number | null | undefined, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(decimals);
}

function mapRangeLabel(activeRange: MetricsRangeKey): string {
  if (activeRange === "FM") return "Current FM";
  if (activeRange === "PREVIOUS") return "Previous FM";
  if (activeRange === "3FM") return "Last 3 FM";
  if (activeRange === "12FM") return "Last 12 FM";
  return String(activeRange);
}

function toTnpsScore(row: any): number | null {
  if (typeof row?.tnps_score === "number" && Number.isFinite(row.tnps_score)) {
    return row.tnps_score;
  }

  if (typeof row?.kpi_value === "number" && Number.isFinite(row.kpi_value)) {
    return row.kpi_value;
  }

  return aggregateTnps([
    {
      tnps_surveys: row?.tnps_surveys,
      tnps_promoters: row?.tnps_promoters,
      tnps_detractors: row?.tnps_detractors,
    },
  ]).tnps_score;
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function buildInspectionTnps(args: {
  payload: any;
  activeRange: MetricsRangeKey;
}): InspectionRenderModel {
  const trend = Array.isArray(args.payload?.trend)
    ? args.payload.trend
    : Array.isArray(args.payload?.debug?.trend)
      ? args.payload.debug.trend
      : Array.isArray(args.payload?.debug?.selected_final_rows)
        ? args.payload.debug.selected_final_rows
        : [];

  const latestRow = trend.length ? trend[trend.length - 1] : null;

  const latestScore = toTnpsScore(latestRow);
  const totalScore = fmtNum(latestScore, 2);
  const totalSurveys = toCount(latestRow?.tnps_surveys);
  const totalPromoters = toCount(latestRow?.tnps_promoters);
  const totalDetractors = toCount(latestRow?.tnps_detractors);

  const trendPoints = trend.map((row: any) => {
    const score = toTnpsScore(row);

    return {
      kpi_value: score,
      is_month_final: !!row.is_month_final,
      band_color:
        score != null && score >= 90
          ? "#22c55e"
          : score != null && score >= 70
            ? "#eab308"
            : score != null
              ? "#ef4444"
              : null,
    };
  });

  const periodRows = trend.map((row: any) => {
    const score = toTnpsScore(row);

    return {
      key: `${row.metric_date ?? "na"}-${row.batch_id ?? "no-batch"}`,
      cells: [
        row.metric_date ?? "—",
        fmtNum(score, 2),
        row.tnps_surveys ?? "—",
        row.tnps_promoters ?? "—",
        row.tnps_detractors ?? "—",
      ],
    };
  });

  return {
    header: {
      title: "tNPS",
      valueDisplay: totalScore,
      rangeLabel: mapRangeLabel(args.activeRange),
    },
    sentiment: {
      kind: "tnps_sentiment",
      totalSurveys,
      totalPromoters,
      totalDetractors,
      title: "Sentiment Mix",
    },
    trend: {
      title: "Trend",
      subtitle: "Checkpoint progression in selected window",
      badgeValue: totalScore,
      currentValue: totalScore,
      updatesCount: trend.length,
      monthsCount:
        args.payload?.debug?.selected_month_count ??
        args.payload?.debug?.distinct_fiscal_month_count ??
        null,
      rangeLabel: mapRangeLabel(args.activeRange),
      points: trendPoints,
    },
    periodDetail: {
      title: "Period Detail",
      columns: [
        { key: "metric_date", label: "Metric Date" },
        {
          key: "tnps",
          label: "tNPS",
          align: "right",
          widthClass: "w-[80px]",
        },
        {
          key: "surveys",
          label: "Surveys",
          align: "right",
          widthClass: "w-[80px]",
        },
        {
          key: "prom",
          label: "Prom",
          align: "right",
          widthClass: "w-[80px]",
        },
        {
          key: "det",
          label: "Detr",
          align: "right",
          widthClass: "w-[80px]",
        },
      ],
      rows: periodRows,
      footer: {
        key: "footer",
        cells: [
          "TOTAL",
          totalScore,
          totalSurveys || "—",
          totalPromoters || "—",
          totalDetractors || "—",
        ],
      },
    },
  };
}