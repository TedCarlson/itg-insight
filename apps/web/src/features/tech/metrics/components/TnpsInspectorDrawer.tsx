"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScorecardTile } from "@/features/metrics/scorecard/lib/scorecard.types";
import MetricPeriodDetailTable from "./MetricPeriodDetailTable";

type RangeKey = "FM" | "3FM" | "12FM";

type TnpsDebug = {
  requested_range: string;
  distinct_fiscal_month_count: number;
  distinct_fiscal_months_found: string[];
  selected_month_count: number;
  selected_final_rows: Array<{
    fiscal_end_date: string;
    metric_date: string;
    batch_id: string;
    rows_in_month: number;
    tnps_surveys: number | null;
    tnps_promoters: number | null;
    tnps_detractors: number | null;
  }>;
  trend?: Array<{
    fiscal_end_date: string;
    metric_date: string;
    batch_id: string;
    tnps_surveys: number | null;
    tnps_promoters: number | null;
    tnps_detractors: number | null;
    kpi_value: number | null;
    is_month_final: boolean;
  }>;
} | null;

function SummaryRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-muted/10 px-3 py-2">
      <div className="text-sm text-muted-foreground">{props.label}</div>
      <div className="text-sm font-semibold">{props.value}</div>
    </div>
  );
}

function formatTnps(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function computeTnps(
  surveys: number,
  promoters: number,
  detractors: number
): number | null {
  if (surveys > 0) return (100 * (promoters - detractors)) / surveys;
  return null;
}

function buildRangeValue(
  rows: Array<{
    tnps_surveys: number | null;
    tnps_promoters: number | null;
    tnps_detractors: number | null;
  }>
): string {
  const surveys = rows.reduce((sum, row) => sum + (row.tnps_surveys ?? 0), 0);
  const promoters = rows.reduce((sum, row) => sum + (row.tnps_promoters ?? 0), 0);
  const detractors = rows.reduce((sum, row) => sum + (row.tnps_detractors ?? 0), 0);
  return formatTnps(computeTnps(surveys, promoters, detractors));
}

function buildMix(
  surveys: number,
  promoters: number,
  detractors: number
): {
  passive: number;
} {
  return {
    passive: Math.max(0, surveys - promoters - detractors),
  };
}

function FaceIcon(props: { tone: "success" | "warning" | "danger" }) {
  const toneMap = {
    success: {
      stroke: "var(--to-success)",
      fill: "color-mix(in oklab, var(--to-success) 12%, white)",
    },
    warning: {
      stroke: "#eab308",
      fill: "color-mix(in oklab, #eab308 12%, white)",
    },
    danger: {
      stroke: "var(--to-danger)",
      fill: "color-mix(in oklab, var(--to-danger) 12%, white)",
    },
  } as const;

  const tone = toneMap[props.tone];

  return (
    <svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true">
      <circle
        cx="13"
        cy="13"
        r="11"
        fill={tone.fill}
        stroke={tone.stroke}
        strokeWidth="1.7"
      />
      <circle cx="9.3" cy="10.4" r="1.1" fill={tone.stroke} />
      <circle cx="16.7" cy="10.4" r="1.1" fill={tone.stroke} />
      {props.tone === "success" ? (
        <path
          d="M8.5 15.1c1.2 1.4 2.8 2.1 4.5 2.1s3.3-.7 4.5-2.1"
          fill="none"
          stroke={tone.stroke}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ) : null}
      {props.tone === "warning" ? (
        <path
          d="M9.2 15.8h7.6"
          fill="none"
          stroke={tone.stroke}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ) : null}
      {props.tone === "danger" ? (
        <path
          d="M8.5 17c1.2-1.4 2.8-2.1 4.5-2.1s3.3.7 4.5 2.1"
          fill="none"
          stroke={tone.stroke}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function MixCard(props: {
  label: string;
  value: number | string;
  tone?: "success" | "warning" | "danger";
}) {
  const toneMap = {
    success: {
      border: "var(--to-success)",
      bg: "color-mix(in oklab, var(--to-success) 7%, white)",
    },
    warning: {
      border: "#eab308",
      bg: "color-mix(in oklab, #eab308 7%, white)",
    },
    danger: {
      border: "var(--to-danger)",
      bg: "color-mix(in oklab, var(--to-danger) 7%, white)",
    },
  } as const;

  const tone = props.tone ? toneMap[props.tone] : null;

  return (
    <div
      className="rounded-xl border px-2 py-2.5"
      style={{
        borderColor: tone?.border ?? "var(--to-border)",
        background: tone?.bg ?? "rgb(var(--muted) / 0.06)",
      }}
    >
      <div className="flex flex-col items-center justify-center gap-1">
        <div className="flex items-center justify-center gap-1.5">
          {props.tone ? <FaceIcon tone={props.tone} /> : null}
          <div className="truncate text-[10px] font-medium tracking-wide text-muted-foreground">
            {props.label}
          </div>
        </div>

        <div className="text-center text-lg font-semibold leading-none text-foreground">
          {props.value}
        </div>
      </div>
    </div>
  );
}

function TnpsSparkline(props: {
  values: Array<{
    kpi_value: number | null;
    is_month_final: boolean;
    band_color?: string | null;
  }>;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [boxWidth, setBoxWidth] = useState(320);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      const next = Math.max(280, Math.floor(el.getBoundingClientRect().width));
      setBoxWidth(next);
    };

    update();

    const observer = new ResizeObserver(() => update());
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const valid = useMemo(
    () =>
      props.values.filter(
        (
          v
        ): v is {
          kpi_value: number;
          is_month_final: boolean;
          band_color?: string | null;
        } => v.kpi_value != null && Number.isFinite(v.kpi_value)
      ),
    [props.values]
  );

  if (!valid.length) {
    return (
      <div
        ref={rootRef}
        className="mt-3 flex h-[148px] w-full items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground"
      >
        No data
      </div>
    );
  }

  const width = boxWidth;
  const height = 148;
  const padLeft = 16;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 18;

  const minRaw = Math.min(...valid.map((v) => v.kpi_value));
  const maxRaw = Math.max(...valid.map((v) => v.kpi_value));

  const min = minRaw - 2;
  const max = maxRaw + 2;
  const range = Math.max(max - min, 1);

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const points = valid.map((v, i) => {
    const x =
      valid.length === 1
        ? padLeft + plotWidth / 2
        : padLeft + (i / (valid.length - 1)) * plotWidth;

    const y = padTop + (1 - (v.kpi_value - min) / range) * plotHeight;

    return {
      x,
      y,
      value: v.kpi_value,
      color: v.band_color ?? "#999999",
      isFinal: v.is_month_final,
      isLast: i === valid.length - 1,
    };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaD = [
    pathD,
    `L ${points[points.length - 1].x} ${height - padBottom}`,
    `L ${points[0].x} ${height - padBottom}`,
    "Z",
  ].join(" ");

  const last = points[points.length - 1];
  const currentDisplay = formatTnps(last.value);
  const minDisplay = formatTnps(minRaw);
  const maxDisplay = formatTnps(maxRaw);

  return (
    <div ref={rootRef} className="mt-3 w-full">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-foreground">Trend</div>
          <div className="text-xs text-muted-foreground">
            Sentiment progression in selected window
          </div>
        </div>

        <div className="rounded-full border px-3 py-1 text-lg font-semibold text-foreground">
          {currentDisplay}
        </div>
      </div>

      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        preserveAspectRatio="none"
      >
        <line
          x1={padLeft}
          y1={padTop}
          x2={width - padRight}
          y2={padTop}
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="1"
        />
        <line
          x1={padLeft}
          y1={padTop + plotHeight / 2}
          x2={width - padRight}
          y2={padTop + plotHeight / 2}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="1"
        />
        <line
          x1={padLeft}
          y1={height - padBottom}
          x2={width - padRight}
          y2={height - padBottom}
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="1"
        />

        <path d={areaD} fill="rgba(0,0,0,0.04)" />
        <path
          d={pathD}
          fill="none"
          stroke="rgba(0,0,0,0.28)"
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <g key={`${p.x}-${p.y}-${i}`}>
            {p.isFinal ? (
              <circle
                cx={p.x}
                cy={p.y}
                r={5}
                fill="white"
                stroke={p.color}
                strokeWidth={2}
              />
            ) : null}

            <circle
              cx={p.x}
              cy={p.y}
              r={p.isLast ? 4.5 : p.isFinal ? 3.2 : 2.2}
              fill={p.color}
            />
          </g>
        ))}

        <text
          x={padLeft}
          y={padTop - 4}
          fontSize="10"
          fill="rgba(0,0,0,0.55)"
        >
          max {maxDisplay}
        </text>

        <text
          x={padLeft}
          y={height - 6}
          fontSize="10"
          fill="rgba(0,0,0,0.55)"
        >
          min {minDisplay}
        </text>
      </svg>

      <div className="mt-3 border-t pt-3">
        <div className="grid grid-cols-5 gap-x-3 gap-y-1">
          <div className="text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Current
          </div>
          <div className="text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Updates
          </div>
          <div className="text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Months
          </div>
          <div className="col-span-2 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Range
          </div>

          <div className="text-center text-lg font-semibold leading-none">
            {currentDisplay}
          </div>
          <div className="text-center text-lg font-semibold leading-none">
            {points.length}
          </div>
          <div className="text-center text-lg font-semibold leading-none">
            {points.filter((p) => p.isFinal).length}
          </div>
          <div className="col-span-2 text-center text-lg font-semibold leading-none whitespace-nowrap">
            {minDisplay}–{maxDisplay}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TnpsInspectorDrawer(props: {
  tile: ScorecardTile | null;
  open: boolean;
  onClose: () => void;
  activeRange: RangeKey;
  tnpsDebug?: TnpsDebug;
}) {
  if (!props.open || !props.tile) return null;

  const topColor = props.tile.band.paint?.border ?? "var(--to-border)";
  const selectedRows = props.tnpsDebug?.selected_final_rows ?? [];
  const trend = props.tnpsDebug?.trend ?? [];

  const currentRows = selectedRows.slice(0, 1);
  const last3Rows = selectedRows.slice(0, 3);
  const last12Rows = selectedRows;

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: "Current FM", value: buildRangeValue(currentRows) },
  ];

  if (props.activeRange !== "FM") {
    summaryRows.push({ label: "Last 3 FM", value: buildRangeValue(last3Rows) });
  }

  if (props.activeRange === "12FM") {
    summaryRows.push({ label: "Last 12 FM", value: buildRangeValue(last12Rows) });
  }

  const totalSurveys = selectedRows.reduce((sum, row) => sum + (row.tnps_surveys ?? 0), 0);
  const totalPromoters = selectedRows.reduce((sum, row) => sum + (row.tnps_promoters ?? 0), 0);
  const totalDetractors = selectedRows.reduce((sum, row) => sum + (row.tnps_detractors ?? 0), 0);
  const totalScore = buildRangeValue(selectedRows);
  const mix = buildMix(totalSurveys, totalPromoters, totalDetractors);

  const periodRows = selectedRows.map((row) => {
    const score = formatTnps(
      computeTnps(row.tnps_surveys ?? 0, row.tnps_promoters ?? 0, row.tnps_detractors ?? 0)
    );

    return {
      key: `${row.metric_date}-${row.batch_id}`,
      cells: [
        row.metric_date,
        score,
        row.tnps_surveys ?? "—",
        row.tnps_promoters ?? "—",
        row.tnps_detractors ?? "—",
      ],
    };
  });

  const periodFooter = {
    key: "footer",
    cells: ["TOTAL", totalScore, totalSurveys || "—", totalPromoters || "—", totalDetractors || "—"],
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close drawer"
        onClick={props.onClose}
        className="fixed inset-0 z-40 bg-black/35"
      />

      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl border bg-card shadow-2xl">
          <div
            className="sticky top-0 z-10 border-b bg-card p-4"
            style={{ borderTop: `4px solid ${topColor}` }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {props.tile.label}
                </div>
                <div className="mt-1 text-2xl font-semibold leading-none text-foreground">
                  {props.tile.value_display ?? "—"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {props.tile.band.label}
                </div>
              </div>

              <button
                type="button"
                onClick={props.onClose}
                className="rounded-xl border px-3 py-2 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="space-y-2">
              {summaryRows.map((row) => (
                <SummaryRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>

            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Sentiment Mix
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                <MixCard label="Surveys" value={totalSurveys || "—"} />
                <MixCard label="Pro" value={totalPromoters || 0} tone="success" />
                <MixCard label="Pass" value={mix.passive} tone="warning" />
                <MixCard label="Det" value={totalDetractors || 0} tone="danger" />
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Chart
              </div>

              <TnpsSparkline
                values={trend.map((t) => ({
                  kpi_value: t.kpi_value,
                  is_month_final: t.is_month_final,
                  band_color:
                    t.kpi_value != null && t.kpi_value >= 50
                      ? "#22c55e"
                      : t.kpi_value != null && t.kpi_value >= 0
                        ? "#eab308"
                        : "#ef4444",
                }))}
              />
            </div>

            <MetricPeriodDetailTable
              title="Period Detail"
              columns={[
                { key: "metric_date", label: "Metric Date" },
                { key: "tnps", label: "tNPS", align: "right", widthClass: "80px" },
                { key: "surveys", label: "Surveys", align: "right", widthClass: "80px" },
                { key: "promoters", label: "Prom", align: "right", widthClass: "80px" },
                { key: "detractors", label: "Detr", align: "right", widthClass: "80px" },
              ]}
              rows={periodRows}
              footer={periodFooter}
            />
          </div>
        </div>
      </div>
    </>
  );
}