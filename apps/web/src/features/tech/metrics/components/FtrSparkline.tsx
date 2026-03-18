"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SparkValue = {
  kpi_value: number | null;
  is_month_final: boolean;
  band_color?: string | null;
};

type Point = {
  x: number;
  y: number;
  value: number;
  color: string;
  isFinal: boolean;
  isLast: boolean;
};

function formatPct1(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function FtrSparkline(props: {
  values: SparkValue[];
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

  const height = 148;
  const padLeft = 16;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 18;

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
        className="flex h-[148px] w-full items-center justify-center text-xs text-muted-foreground"
      >
        No data
      </div>
    );
  }

  const minRaw = Math.min(...valid.map((v) => v.kpi_value));
  const maxRaw = Math.max(...valid.map((v) => v.kpi_value));

  const min = minRaw - 0.35;
  const max = maxRaw + 0.35;
  const range = Math.max(max - min, 1);

  const width = boxWidth;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const points: Point[] = valid.map((v, i) => {
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
  const currentDisplay = formatPct1(last.value);
  const minDisplay = formatPct1(minRaw);
  const maxDisplay = formatPct1(maxRaw);
  const rangeDisplay = `${minDisplay}–${maxDisplay}`;

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-foreground">Trend</div>
          <div className="text-xs text-muted-foreground">
            Checkpoint progression in selected window
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
          <div className="text-[10px] uppercase tracking-[0.18em] text-center text-muted-foreground">
            Current
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-center text-muted-foreground">
            Updates
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-center text-muted-foreground">
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
            {rangeDisplay}
          </div>
        </div>
      </div>
    </div>
  );
}