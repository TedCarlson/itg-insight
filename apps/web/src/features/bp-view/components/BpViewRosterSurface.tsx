"use client";

import { useState } from "react";

import type {
  BpViewRosterMetricCell,
  BpViewRosterRow,
} from "../lib/bpView.types";

function bandPillClass(bandKey: string) {
  if (bandKey === "EXCEEDS") {
    return "border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_10%,white)]";
  }
  if (bandKey === "MEETS") {
    return "border-[var(--to-primary)] bg-[color-mix(in_oklab,var(--to-primary)_10%,white)]";
  }
  if (bandKey === "NEEDS_IMPROVEMENT") {
    return "border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_10%,white)]";
  }
  if (bandKey === "MISSES") {
    return "border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_10%,white)]";
  }
  return "border-[var(--to-border)] bg-muted/10";
}

function isSecondaryMetric(index: number) {
  return index >= 3;
}

function sectionDividerClass(index: number) {
  return index === 3 ? "border-l border-[var(--to-border)] pl-4" : "";
}

function MobileMetricCard(props: { metric: BpViewRosterMetricCell }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${bandPillClass(props.metric.band_key)}`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {props.metric.label}
      </div>
      <div className="mt-1 text-sm font-semibold">
        {props.metric.value_display ?? "—"}
      </div>
    </div>
  );
}

function MobileWorkMixCard(props: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-muted/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className="mt-1 text-sm font-semibold">{props.value}</div>
    </div>
  );
}

function MobileRowCard(props: {
  row: BpViewRosterRow;
  onSelectRow: (row: BpViewRosterRow) => void;
  showWorkMix: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onSelectRow(props.row)}
      className="w-full rounded-2xl border bg-card p-4 text-left active:scale-[0.99]"
    >
      <div className="text-sm font-semibold">{props.row.full_name}</div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {props.row.metrics.map((metric) => (
          <MobileMetricCard key={metric.kpi_key} metric={metric} />
        ))}
      </div>

      {props.showWorkMix ? (
        <div className="mt-3 rounded-xl border bg-muted/10 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Work Mix
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <MobileWorkMixCard label="Installs" value={props.row.work_mix.installs} />
            <MobileWorkMixCard label="TCs" value={props.row.work_mix.tcs} />
            <MobileWorkMixCard label="SROs" value={props.row.work_mix.sros} />
            <MobileWorkMixCard label="Jobs" value={props.row.work_mix.total} />
          </div>
        </div>
      ) : null}

      <div className="mt-3 text-xs text-muted-foreground">
        Below target count: {props.row.below_target_count}
      </div>
    </button>
  );
}

function DesktopHeaderCell(props: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  return (
    <div
      className={[
        "px-2 py-2 text-[11px] font-medium text-muted-foreground",
        props.align === "right"
          ? "text-right"
          : props.align === "center"
            ? "text-center"
            : "text-left",
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

function DesktopCell(props: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  strong?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        "px-2 py-2.5 text-sm",
        props.align === "right"
          ? "text-right"
          : props.align === "center"
            ? "text-center"
            : "text-left",
        props.strong ? "font-semibold" : "",
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

function DesktopMetricBadge(props: {
  metric: BpViewRosterMetricCell | undefined;
  secondary?: boolean;
}) {
  if (!props.metric) {
    return (
      <div
        className={[
          "inline-flex min-w-[58px] items-center justify-center rounded-md border border-[var(--to-border)] bg-muted/10 px-2 py-1 text-sm",
          props.secondary ? "opacity-95" : "",
        ].join(" ")}
      >
        —
      </div>
    );
  }

  return (
    <div
      className={[
        `inline-flex min-w-[58px] items-center justify-center rounded-md border px-2 py-1 text-sm font-medium ${bandPillClass(props.metric.band_key)}`,
        props.secondary ? "opacity-95" : "",
      ].join(" ")}
    >
      {props.metric.value_display ?? "—"}
    </div>
  );
}

function DesktopWorkMixBadge(props: {
  value: number;
}) {
  return (
    <div className="inline-flex min-w-[58px] items-center justify-center rounded-md border border-[var(--to-border)] bg-muted/10 px-2 py-1 text-sm font-medium">
      {props.value}
    </div>
  );
}

export default function BpViewRosterSurface(props: {
  columns: Array<{ kpi_key: string; label: string }>;
  rows: BpViewRosterRow[];
  onSelectRow: (row: BpViewRosterRow) => void;
}) {
  const [showWorkMix, setShowWorkMix] = useState(false);

  const workMixColumnCount = showWorkMix ? 4 : 0;
  const gridTemplate = `180px repeat(${props.columns.length}, minmax(84px, 1fr)) ${
    showWorkMix ? "repeat(4, minmax(84px, 1fr)) " : ""
  }72px`;
  const minWidth = showWorkMix ? "1380px" : "1040px";

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Team KPI table
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Drilldown enabled • Tap/click to view details for each tech
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowWorkMix((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
        >
          <span>{showWorkMix ? "Hide work mix" : "Show work mix"}</span>
          <span className="opacity-70">+4</span>
          <span className={`transition-transform ${showWorkMix ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
      </div>

      <div className="space-y-3 md:hidden">
        {props.rows.map((row) => (
          <MobileRowCard
            key={row.person_id}
            row={row}
            onSelectRow={props.onSelectRow}
            showWorkMix={showWorkMix}
          />
        ))}
      </div>

      <div className="hidden md:block">
        <div className="overflow-auto rounded-2xl border">
          <div
            className="grid border-b bg-muted/10"
            style={{ gridTemplateColumns: gridTemplate, minWidth }}
          >
            <DesktopHeaderCell>Tech</DesktopHeaderCell>

            {props.columns.map((col, index) => (
              <DesktopHeaderCell
                key={col.kpi_key}
                align="center"
                className={sectionDividerClass(index)}
              >
                {col.label}
              </DesktopHeaderCell>
            ))}

            {showWorkMix ? (
              <>
                <DesktopHeaderCell
                  align="center"
                  className="border-l border-[var(--to-border)] pl-4"
                >
                  Installs
                </DesktopHeaderCell>
                <DesktopHeaderCell align="center">TCs</DesktopHeaderCell>
                <DesktopHeaderCell align="center">SROs</DesktopHeaderCell>
                <DesktopHeaderCell align="center">Jobs</DesktopHeaderCell>
              </>
            ) : null}

            <DesktopHeaderCell align="center">Risk</DesktopHeaderCell>
          </div>

          {props.rows.map((row) => (
            <button
              key={row.person_id}
              type="button"
              onClick={() => props.onSelectRow(row)}
              className="grid w-full border-b text-left hover:bg-muted/10"
              style={{ gridTemplateColumns: gridTemplate, minWidth }}
            >
              <DesktopCell strong>
                <div>{row.full_name}</div>
              </DesktopCell>

              {props.columns.map((col, index) => {
                const metric = row.metrics.find((m) => m.kpi_key === col.kpi_key);

                return (
                  <DesktopCell
                    key={col.kpi_key}
                    align="center"
                    className={sectionDividerClass(index)}
                  >
                    <DesktopMetricBadge
                      metric={metric}
                      secondary={isSecondaryMetric(index)}
                    />
                  </DesktopCell>
                );
              })}

              {showWorkMix ? (
                <>
                  <DesktopCell
                    align="center"
                    className="border-l border-[var(--to-border)] pl-4"
                  >
                    <DesktopWorkMixBadge value={row.work_mix.installs} />
                  </DesktopCell>
                  <DesktopCell align="center">
                    <DesktopWorkMixBadge value={row.work_mix.tcs} />
                  </DesktopCell>
                  <DesktopCell align="center">
                    <DesktopWorkMixBadge value={row.work_mix.sros} />
                  </DesktopCell>
                  <DesktopCell align="center">
                    <DesktopWorkMixBadge value={row.work_mix.total} />
                  </DesktopCell>
                </>
              ) : null}

              <DesktopCell align="center">{row.below_target_count}</DesktopCell>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}