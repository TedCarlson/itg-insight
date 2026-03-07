"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useOrg } from "@/state/org";

type TrendPoint = {
  fiscal_month: string;
  metric_date: string;
  value: number | null;
  sample: number | null;
};

type TrendResponse = {
  kpi_key: string;
  fiscal_window: "FM" | "3FM" | "12FM";
  direction: "HIGHER_BETTER" | "LOWER_BETTER";
  series: TrendPoint[];
  overlays?: {
    short_window_label: string;
    long_window_label: string;
    short_avg: number | null;
    long_avg: number | null;
    delta: number | null;
    state: string;
  };
};

type Paint = {
  preset?: string | null;
  bg?: string | null;
  border?: string | null;
  ink?: string | null;
};

type FiscalWindow = "FM" | "3FM" | "12FM";

type PointXY = {
  i: number;
  x: number;
  y: number;
  value: number;
  metric_date: string;
  sample: number | null;
};

const WIDTH = 760;
const HEIGHT = 280;
const PAD_L = 52;
const PAD_R = 20;
const PAD_T = 18;
const PAD_B = 30;

const WINDOW_META: Record<
  FiscalWindow,
  {
    subtitle: string;
    compareLabel: string;
  }
> = {
  FM: {
    subtitle: "current fiscal month",
    compareLabel: "vs recent baseline",
  },
  "3FM": {
    subtitle: "last 3 fiscal months",
    compareLabel: "quarter view",
  },
  "12FM": {
    subtitle: "last 12 fiscal months",
    compareLabel: "annual view",
  },
};

function clamp01(n: number) {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function parsePersonIdFromPath(): string | null {
  try {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "tech-scorecard");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return null;
  } catch {
    return null;
  }
}

function fmtMMDD(dateStr: string) {
  const s = String(dateStr || "").slice(0, 10);
  const m = s.slice(5, 7);
  const d = s.slice(8, 10);
  if (!m || !d) return "—";
  return `${m}/${d}`;
}

function looksLikeRate(kpiKey: string) {
  const lower = kpiKey.toLowerCase();
  return (
    lower.endsWith("_rate") ||
    lower.endsWith("_pct") ||
    lower.includes("rate") ||
    lower.includes("pct")
  );
}

function fmtValue(kpiKey: string, v: number | null): string {
  if (!isFiniteNum(v)) return "—";
  if (looksLikeRate(kpiKey)) {
    const pct = v <= 1.5 ? v * 100 : v;
    return `${pct.toFixed(pct >= 10 ? 0 : 1)}%`;
  }
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function toSemanticDelta(
  rawDelta: number | null,
  direction: "HIGHER_BETTER" | "LOWER_BETTER" | undefined
): number | null {
  if (!isFiniteNum(rawDelta)) return null;
  return direction === "LOWER_BETTER" ? rawDelta * -1 : rawDelta;
}

function fmtSemanticDelta(kpiKey: string, semanticDelta: number | null) {
  if (!isFiniteNum(semanticDelta)) return "—";

  if (looksLikeRate(kpiKey)) {
    const pct =
      semanticDelta <= 1.5 && semanticDelta >= -1.5
        ? semanticDelta * 100
        : semanticDelta;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(Math.abs(pct) >= 10 ? 0 : 1)}%`;
  }

  const sign = semanticDelta > 0 ? "+" : "";
  return `${sign}${semanticDelta.toFixed(1)}`;
}

function sampleLabelForKpi(kpiKey: string) {
  switch (kpiKey) {
    case "ftr_rate":
      return "FTR jobs in range";
    case "tool_usage_rate":
      return "TU eligible jobs in range";
    case "tnps_score":
      return "tNPS surveys in range";
    case "met_rate":
      return "MET appts in range";
    case "contact_48hr_rate":
      return "48hr contact jobs in range";
    case "pht_pure_pass_rate":
    case "soi_rate":
    case "repeat_rate":
    case "rework_rate":
      return "Jobs in range";
    default:
      return "Observations in range";
  }
}

function buildPoints(series: TrendPoint[]) {
  const finite = series
    .map((p, i) => ({ i, ...p }))
    .filter((p) => isFiniteNum(p.value)) as Array<{
    i: number;
    fiscal_month: string;
    metric_date: string;
    value: number;
    sample: number | null;
  }>;

  if (finite.length < 2) {
    return {
      points: [] as PointXY[],
      min: null as number | null,
      max: null as number | null,
    };
  }

  const vals = finite.map((p) => p.value);
  const minRaw = Math.min(...vals);
  const maxRaw = Math.max(...vals);

  const spanRaw = maxRaw - minRaw;
  const pad =
    spanRaw === 0
      ? Math.max(Math.abs(maxRaw) * 0.02, 1)
      : Math.max(spanRaw * 0.18, 0.5);

  const min = minRaw - pad;
  const max = maxRaw + pad;
  const span = max - min || 1;

  const plotW = WIDTH - PAD_L - PAD_R;
  const plotH = HEIGHT - PAD_T - PAD_B;

  const points: PointXY[] = finite.map((p) => {
    const x = PAD_L + (p.i / Math.max(1, finite.length - 1)) * plotW;
    const yNorm = (p.value - min) / span;
    const y = PAD_T + (1 - clamp01(yNorm)) * plotH;
    return {
      i: p.i,
      x,
      y,
      value: p.value,
      metric_date: p.metric_date,
      sample: p.sample ?? null,
    };
  });

  return { points, min: minRaw, max: maxRaw };
}

function polylineFromPoints(points: PointXY[]) {
  if (points.length < 2) return null;
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

function areaPathFromPoints(points: PointXY[]) {
  if (points.length < 2) return null;
  const baseY = HEIGHT - PAD_B;
  const first = points[0];
  const last = points[points.length - 1];
  const line = points.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  return `M ${first.x.toFixed(2)} ${baseY.toFixed(2)} L ${first.x.toFixed(
    2
  )} ${first.y.toFixed(2)} ${line} L ${last.x.toFixed(2)} ${baseY.toFixed(2)} Z`;
}

function nearestPoint(points: PointXY[], mouseX: number) {
  if (!points.length) return null;
  let best = points[0];
  let bestD = Math.abs(points[0].x - mouseX);
  for (let i = 1; i < points.length; i++) {
    const d = Math.abs(points[i].x - mouseX);
    if (d < bestD) {
      best = points[i];
      bestD = d;
    }
  }
  return best;
}

function observationsByFiscalMonthMax(series: TrendPoint[]) {
  const maxByMonth = new Map<string, number>();

  for (const row of series) {
    if (!isFiniteNum(row.sample)) continue;
    const prior = maxByMonth.get(row.fiscal_month) ?? 0;
    if (row.sample > prior) maxByMonth.set(row.fiscal_month, row.sample);
  }

  let total = 0;
  for (const v of maxByMonth.values()) total += v;
  return total;
}

export default function KpiTrendChart(props: {
  kpiKey: string;
  fiscalWindow: FiscalWindow;
  personId?: string | null;
  paint?: Paint | null;
}) {
  const { selectedOrgId } = useOrg();

  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<PointXY | null>(null);

  const svgWrapRef = useRef<HTMLDivElement | null>(null);

  const personId = props.personId ?? parsePersonIdFromPath();
  const rid = useId().replaceAll(":", "_");
  const idGlow = `trend_line_glow_${rid}`;
  const idBeam = `trend_beam_${rid}`;

  const meta = WINDOW_META[props.fiscalWindow];

  const accent = props.paint?.border?.trim() || "var(--to-accent)";
  const accentInk = props.paint?.ink?.trim() || accent;

  const chipBg = "color-mix(in srgb, var(--to-surface) 84%, var(--to-surface-2) 16%)";
  const chipBorder = "color-mix(in srgb, var(--to-border) 78%, var(--to-accent) 22%)";

  const panelBg =
    "radial-gradient(circle at top left, color-mix(in srgb, var(--to-info) 10%, white) 0%, color-mix(in srgb, var(--to-surface) 76%, white) 42%, color-mix(in srgb, var(--to-surface-soft) 22%, white) 100%)";

  const panelBorder = "var(--to-border)";
  const plotFill = "color-mix(in srgb, var(--to-surface) 78%, var(--to-surface-2) 22%)";
  const plotStroke = "color-mix(in srgb, var(--to-border) 86%, transparent 14%)";
  const grid = "color-mix(in srgb, var(--to-accent) 10%, transparent)";
  const labelInk = "var(--to-ink-muted)";
  const tooltipBg =
    "linear-gradient(180deg, color-mix(in srgb, white 88%, var(--to-surface) 12%), color-mix(in srgb, var(--to-surface) 92%, var(--to-surface-2) 8%))";
  const tooltipBorder = "color-mix(in srgb, var(--to-border) 84%, white 16%)";
  const tooltipInk = "var(--to-ink)";
  const tooltipSub = "var(--to-ink-muted)";

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function run() {
      if (!selectedOrgId || !personId) {
        if (alive) {
          setData({
            kpi_key: props.kpiKey,
            fiscal_window: props.fiscalWindow,
            direction: "HIGHER_BETTER",
            series: [],
          });
        }
        return;
      }

      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("pc_org_id", selectedOrgId);
        qs.set("person_id", personId);
        qs.set("kpi_key", props.kpiKey);
        qs.set("fiscal_window", props.fiscalWindow);

        const res = await fetch(`/api/metrics/trend?${qs.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Trend request failed: ${res.status}`);

        const json = (await res.json()) as TrendResponse;
        if (alive) setData(json);
      } catch {
        if (alive) {
          setData({
            kpi_key: props.kpiKey,
            fiscal_window: props.fiscalWindow,
            direction: "HIGHER_BETTER",
            series: [],
          });
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [props.kpiKey, props.fiscalWindow, personId, selectedOrgId]);

  const series = useMemo(() => data?.series ?? [], [data?.series]);
  const built = useMemo(() => buildPoints(series), [series]);
  const polyline = useMemo(() => polylineFromPoints(built.points), [built.points]);
  const areaPath = useMemo(() => areaPathFromPoints(built.points), [built.points]);

  const last = built.points.length ? built.points[built.points.length - 1] : null;
  const minLabel = isFiniteNum(built.min) ? fmtValue(props.kpiKey, built.min) : "—";
  const maxLabel = isFiniteNum(built.max) ? fmtValue(props.kpiKey, built.max) : "—";

  const updatesCount = series.filter((p) => isFiniteNum(p.value)).length;
  const lastUpdate = last?.metric_date ? fmtMMDD(last.metric_date) : "—";
  const observations = observationsByFiscalMonthMax(series);

  const rawMomentumDelta = data?.overlays?.delta ?? null;
  const semanticMomentumDelta = toSemanticDelta(rawMomentumDelta, data?.direction);
  const momentumState = String(data?.overlays?.state ?? "NO_DATA").toUpperCase();

  const momentumLabel =
    momentumState === "UP"
      ? "Improving"
      : momentumState === "DOWN"
        ? "Softening"
        : momentumState === "FLAT"
          ? "Stable"
          : "No signal";

  const waypointEvery = updatesCount > 24 ? 3 : 2;
  const observationsLabel = sampleLabelForKpi(props.kpiKey);

  return (
    <div
      className="rounded-[28px] border p-4 backdrop-blur-xl"
      style={{
        background: panelBg,
        borderColor: panelBorder,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.70), 0 12px 30px rgba(59,130,246,0.05)",
      }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold tracking-tight" style={{ color: "var(--to-ink)" }}>
            Trend
          </div>
          <div className="mt-1 text-sm" style={{ color: "var(--to-ink-muted)" }}>
            {props.kpiKey} • {meta.subtitle}
          </div>
        </div>

        <div className="flex min-w-[180px] flex-col items-end gap-2">
          <div
            className="rounded-full border px-4 py-2 text-2xl font-semibold tracking-tight"
            style={{
              color: accentInk,
              borderColor: chipBorder,
              background: chipBg,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.55) inset",
            }}
          >
            {last ? fmtValue(props.kpiKey, last.value) : "—"}
          </div>
          <div className="text-xs" style={{ color: "var(--to-ink-muted)" }}>
            {meta.compareLabel}
            {loading ? " • Loading…" : ""}
          </div>
        </div>
      </div>

      <div>
        {polyline && areaPath ? (
          <div
            ref={svgWrapRef}
            className="relative"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const el = svgWrapRef.current;
              if (!el) return;
              const rect = el.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const vbX = (x / rect.width) * WIDTH;
              setHover(nearestPoint(built.points, vbX));
            }}
          >
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-56 w-full">
              <defs>
                <filter id={idGlow} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <linearGradient id={idBeam} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity="0" />
                  <stop offset="35%" stopColor={accent} stopOpacity="0.10" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0" />
                </linearGradient>
              </defs>

              <rect
                x={PAD_L}
                y={PAD_T}
                width={WIDTH - PAD_L - PAD_R}
                height={HEIGHT - PAD_T - PAD_B}
                rx="20"
                fill={plotFill}
                stroke={plotStroke}
              />

              {Array.from({ length: 4 }).map((_, idx) => {
                const y = PAD_T + (idx / 3) * (HEIGHT - PAD_T - PAD_B);
                return (
                  <line
                    key={idx}
                    x1={PAD_L}
                    x2={WIDTH - PAD_R}
                    y1={y}
                    y2={y}
                    stroke={grid}
                    strokeWidth="1"
                  />
                );
              })}

              <text x={10} y={PAD_T + 10} fontSize="12" fill={labelInk}>
                max {maxLabel}
              </text>
              <text x={10} y={HEIGHT - PAD_B + 2} fontSize="12" fill={labelInk}>
                min {minLabel}
              </text>

              {last ? (
                <rect
                  x={Math.max(PAD_L, last.x - 28)}
                  y={PAD_T}
                  width={56}
                  height={HEIGHT - PAD_T - PAD_B}
                  fill={`url(#${idBeam})`}
                  rx="22"
                />
              ) : null}

              <path d={areaPath} fill={accent} opacity={0.1} />

              <polyline
                points={polyline}
                fill="none"
                stroke={accent}
                strokeWidth="5.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.16}
                filter={`url(#${idGlow})`}
              />

              <polyline
                points={polyline}
                fill="none"
                stroke={accent}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {built.points.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r={idx === built.points.length - 1 ? 5.5 : idx % waypointEvery === 0 ? 2.8 : 0}
                  fill={accent}
                  opacity={idx === built.points.length - 1 ? 1 : 0.45}
                />
              ))}

              {hover ? (
                <>
                  <line
                    x1={hover.x}
                    x2={hover.x}
                    y1={PAD_T}
                    y2={HEIGHT - PAD_B}
                    stroke="rgba(51,65,85,0.24)"
                    strokeWidth="1"
                    strokeDasharray="4 5"
                  />
                  <circle cx={hover.x} cy={hover.y} r={8} fill={accent} opacity={0.12} />
                  <circle cx={hover.x} cy={hover.y} r={4} fill={accent} />
                </>
              ) : null}
            </svg>

            {hover ? (
              <div
                className="pointer-events-none absolute z-20"
                style={{
                  left: `${Math.max(10, Math.min((hover.x / WIDTH) * 100, 88))}%`,
                  top: "26%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  className="rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl"
                  style={{
                    color: tooltipInk,
                    background: tooltipBg,
                    borderColor: tooltipBorder,
                    boxShadow: "0 16px 36px rgba(15,23,42,0.12), 0 0 0 1px rgba(255,255,255,0.55) inset",
                  }}
                >
                  <div className="text-2xl font-semibold tracking-tight" style={{ color: accentInk }}>
                    {fmtValue(props.kpiKey, hover.value)}
                  </div>
                  <div className="mt-1 text-sm" style={{ color: tooltipSub }}>
                    {fmtMMDD(hover.metric_date)}
                    {hover.sample != null ? ` • n=${hover.sample}` : ""}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className="flex h-56 items-center justify-center rounded-[20px] border text-sm"
            style={{
              color: "var(--to-ink-muted)",
              background: "color-mix(in srgb, var(--to-surface) 86%, white 14%)",
              borderColor: "var(--to-border)",
            }}
          >
            No trend data
          </div>
        )}
      </div>

      <div
        className="mt-4 border-t pt-4"
        style={{
          borderColor: "color-mix(in srgb, var(--to-border) 72%, transparent)",
        }}
      >
        <div className="text-sm font-semibold" style={{ color: "var(--to-ink)" }}>
          Quick stats
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--to-ink-muted)" }}>
              Current
            </div>
            <div className="mt-1 text-xl font-semibold" style={{ color: accentInk }}>
              {last ? fmtValue(props.kpiKey, last.value) : "—"}
            </div>
            <div className="text-sm" style={{ color: "var(--to-ink-muted)" }}>
              as of {lastUpdate}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--to-ink-muted)" }}>
              Momentum
            </div>
            <div className="mt-1 text-xl font-semibold" style={{ color: accentInk }}>
              {fmtSemanticDelta(props.kpiKey, semanticMomentumDelta)}
            </div>
            <div className="text-sm" style={{ color: "var(--to-ink-muted)" }}>
              {momentumLabel} • {meta.compareLabel}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--to-ink-muted)" }}>
              Updates
            </div>
            <div className="mt-1 text-xl font-semibold" style={{ color: "var(--to-ink)" }}>
              {updatesCount}
            </div>
            <div className="text-sm" style={{ color: "var(--to-ink-muted)" }}>
              batch checkpoints in view
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--to-ink-muted)" }}>
              Observations
            </div>
            <div className="mt-1 text-xl font-semibold" style={{ color: "var(--to-ink)" }}>
              {observations || "—"}
            </div>
            <div className="text-sm" style={{ color: "var(--to-ink-muted)" }}>
              {observationsLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}