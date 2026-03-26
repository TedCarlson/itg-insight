"use client";

import React from "react";

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

  const numericValue =
    typeof props.value === "number" ? props.value : Number(props.value);

  const isZero = !numericValue;
  const effectiveTone = !isZero && props.tone ? toneMap[props.tone] : null;

  return (
    <div
      className="rounded-xl border px-2 py-2.5"
      style={{
        borderColor: effectiveTone?.border ?? "var(--to-border)",
        background: effectiveTone?.bg ?? "rgb(var(--muted) / 0.06)",
      }}
    >
      <div className="flex flex-col items-center justify-center gap-1">
        <div className="flex items-center justify-center gap-1.5">
          {effectiveTone ? <FaceIcon tone={props.tone!} /> : null}
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

export default function BpTnpsSentimentMix(props: {
  totalSurveys: number;
  totalPromoters: number;
  totalDetractors: number;
  title?: string;
}) {
  const passive = Math.max(
    0,
    props.totalSurveys - props.totalPromoters - props.totalDetractors
  );

  return (
    <div className="rounded-2xl border bg-muted/10 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {props.title ?? "Sentiment Mix"}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <MixCard label="Surveys" value={props.totalSurveys || "—"} />
        <MixCard label="Pro" value={props.totalPromoters || 0} tone="success" />
        <MixCard label="Pass" value={passive} tone="warning" />
        <MixCard label="Det" value={props.totalDetractors || 0} tone="danger" />
      </div>
    </div>
  );
}