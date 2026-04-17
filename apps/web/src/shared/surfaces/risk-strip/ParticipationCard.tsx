// path: apps/web/src/shared/surfaces/risk-strip/ParticipationCard.tsx

"use client";

import type {
  MetricsRiskInsights,
  MetricsRiskTrendDirection,
} from "@/shared/types/metrics/surfacePayload";

type ParticipationOverlayMode = "meets_3" | "meets_2" | "meets_1" | "meets_0";

type Segment = {
  key: ParticipationOverlayMode;
  label: string;
  shortLabel: string;
  count: number;
  colorClass: string;
  textClass: string;
};

function percent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function scoreBandTone(bandKey: string | null | undefined) {
  if (bandKey === "EXCEEDS") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (bandKey === "MEETS") {
    return "border-lime-200 bg-lime-50 text-lime-700";
  }
  if (bandKey === "NEEDS_IMPROVEMENT") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (bandKey === "MISSES") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-border bg-muted/30 text-muted-foreground";
}

function trendTone(direction: MetricsRiskTrendDirection) {
  if (direction === "up") return "text-emerald-600";
  if (direction === "down") return "text-rose-600";
  return "text-muted-foreground";
}

function trendPrefix(direction: MetricsRiskTrendDirection) {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "—";
}

function formatDelta(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.abs(value).toFixed(1)}`;
}

function bandLabel(bandKey: string | null | undefined) {
  if (bandKey === "EXCEEDS") return "Exceeds";
  if (bandKey === "MEETS") return "Meets";
  if (bandKey === "NEEDS_IMPROVEMENT") return "Needs Improvement";
  if (bandKey === "MISSES") return "Misses";
  return "No Data";
}

export default function ParticipationCard(props: {
  insights: MetricsRiskInsights;
  onSelect: (mode: ParticipationOverlayMode) => void;
}) {
  const { insights, onSelect } = props;

  const p = insights.participation;
  const total =
    p.meets_3.count + p.meets_2.count + p.meets_1.count + p.meets_0.count;

  const signal = insights.participation_signal ?? null;

  const segments: Segment[] = [
    {
      key: "meets_3",
      label: "Meets 3/3",
      shortLabel: "3/3",
      count: p.meets_3.count,
      colorClass: "bg-emerald-500",
      textClass: "text-emerald-700",
    },
    {
      key: "meets_2",
      label: "Meets 2/3",
      shortLabel: "2/3",
      count: p.meets_2.count,
      colorClass: "bg-lime-500",
      textClass: "text-lime-700",
    },
    {
      key: "meets_1",
      label: "Meets 1/3",
      shortLabel: "1/3",
      count: p.meets_1.count,
      colorClass: "bg-amber-500",
      textClass: "text-amber-700",
    },
    {
      key: "meets_0",
      label: "Meets 0/3",
      shortLabel: "0/3",
      count: p.meets_0.count,
      colorClass: "bg-rose-500",
      textClass: "text-rose-700",
    },
  ];

  const topSegment =
    segments.slice().sort((a, b) => b.count - a.count)[0] ?? null;

  return (
    <div className="rounded-xl border bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Participation
      </div>

      <div className="mt-2 space-y-1.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] text-muted-foreground">Eligible Techs</div>
            <div className="text-lg font-semibold leading-none">
              {signal?.eligible_count ?? total}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">Top Segment</div>
            <div className="text-sm font-medium leading-none">
              {topSegment?.label ?? "—"}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex h-5 overflow-hidden rounded-full border bg-muted/60">
            {segments.map((segment) => {
              const width = total > 0 ? (segment.count / total) * 100 : 0;
              const pct = percent(segment.count, total);
              const showInlineLabel = width >= 18;

              return (
                <button
                  key={segment.key}
                  type="button"
                  onClick={() => onSelect(segment.key)}
                  className={[
                    "relative h-full transition hover:brightness-95",
                    segment.colorClass,
                  ].join(" ")}
                  style={{ width: `${Math.max(width, segment.count > 0 ? 3 : 0)}%` }}
                  aria-label={`${segment.label} ${segment.count} of ${total} (${pct}%)`}
                  title={`${segment.label} · ${segment.count} techs · ${pct}%`}
                >
                  {showInlineLabel ? (
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white">
                      {segment.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1">
            {segments.map((segment) => {
              const pct = percent(segment.count, total);

              return (
                <button
                  key={segment.key}
                  type="button"
                  onClick={() => onSelect(segment.key)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] transition hover:bg-muted/40"
                  title={`${segment.label} · ${segment.count} techs · ${pct}%`}
                >
                  <span
                    className={["h-1.5 w-1.5 rounded-full", segment.colorClass].join(" ")}
                  />
                  <span className="text-muted-foreground">{segment.shortLabel}</span>
                  <span className="font-semibold">{segment.count}</span>
                  <span className={segment.textClass}>{pct}%</span>
                </button>
              );
            })}
          </div>
        </div>

        {signal ? (
          <div className="space-y-1.5 border-t border-border/50 pt-1.5">
            <div className="grid grid-cols-3 gap-1">
              {signal.by_kpi.map((item) => (
                <div
                  key={item.kpi_key}
                  className="rounded-lg border bg-card px-2 py-1"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 text-[9px] uppercase tracking-wide text-muted-foreground">
                      <span className="block truncate">{item.label}</span>
                    </div>

                    <span
                      className={[
                        "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[8px] font-medium",
                        scoreBandTone(item.band_key),
                      ].join(" ")}
                    >
                      {bandLabel(item.band_key)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-end justify-between gap-1.5">
                    <div className="text-[12px] font-semibold leading-none">
                      {item.score.toFixed(1)}%
                    </div>

                    <div
                      className={[
                        "text-[9px] font-medium leading-none",
                        trendTone(item.trend_direction),
                      ].join(" ")}
                    >
                      {item.trend_delta == null
                        ? "—"
                        : `${trendPrefix(item.trend_direction)} ${formatDelta(
                            item.trend_delta
                          )}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border bg-[color-mix(in_oklab,var(--to-primary)_6%,white)] px-2.5 py-1.5">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    Participation Score
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="text-[15px] font-semibold leading-none">
                      {signal.overall_score.toFixed(1)}%
                    </div>
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[8px] font-medium",
                        scoreBandTone(signal.overall_band_key),
                      ].join(" ")}
                    >
                      {bandLabel(signal.overall_band_key)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    Trend
                  </div>
                  <div
                    className={[
                      "mt-1 text-[11px] font-semibold leading-none",
                      trendTone(signal.trend_direction),
                    ].join(" ")}
                  >
                    {signal.trend_delta == null
                      ? "—"
                      : `${trendPrefix(signal.trend_direction)} ${formatDelta(
                          signal.trend_delta
                        )}`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}