"use client";

import { useState } from "react";

import type { CompanySupervisorParityRow } from "../lib/companySupervisorView.types";

export type CompanySupervisorPrimarySegment = "ALL" | "ITG" | "BP";

function formatMetricValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function bandPillClass(bandKey?: string | null) {
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
  value: number | null;
  band?: string | null;
  secondary?: boolean;
}) {
  return (
    <div
      className={[
        `inline-flex min-w-[58px] items-center justify-center rounded-md border px-2 py-1 text-sm font-medium ${bandPillClass(props.band)}`,
        props.secondary ? "opacity-95" : "",
      ].join(" ")}
    >
      {formatMetricValue(props.value)}
    </div>
  );
}

function DesktopCountBadge(props: {
  value: number;
}) {
  return (
    <div className="inline-flex min-w-[58px] items-center justify-center rounded-md border border-[var(--to-border)] bg-muted/10 px-2 py-1 text-sm font-medium">
      {props.value}
    </div>
  );
}

export default function CompanySupervisorParityTable(props: {
  rows: CompanySupervisorParityRow[];
  rosterColumns: Array<{ kpi_key: string; label: string }>;
  primarySegment: CompanySupervisorPrimarySegment;
  bpContractor: string;
}) {
  const { rows, rosterColumns } = props;
  const [isOpen, setIsOpen] = useState(false);

  const gridTemplate = `180px repeat(${rosterColumns.length}, minmax(84px, 1fr)) 72px`;
  const minWidth = "1040px";

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Team Parity
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Comparative view for the active workforce slice
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
        >
          <span>{isOpen ? "Hide parity" : "Show parity"}</span>
          <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
      </div>

      {isOpen ? (
        <div className="mt-4 rounded-2xl border bg-muted/[0.04] p-4">
          <div className="mb-3 text-sm text-muted-foreground">
            KPI order aligned to team performance
          </div>

          <div className="overflow-auto rounded-2xl border">
            <div
              className="grid border-b bg-muted/10"
              style={{ gridTemplateColumns: gridTemplate, minWidth }}
            >
              <DesktopHeaderCell>Group</DesktopHeaderCell>

              {rosterColumns.map((col, index) => (
                <DesktopHeaderCell
                  key={col.kpi_key}
                  align="center"
                  className={sectionDividerClass(index)}
                >
                  {col.label}
                </DesktopHeaderCell>
              ))}

              <DesktopHeaderCell align="center">HC</DesktopHeaderCell>
            </div>

            {rows.map((row) => (
              <div
                key={row.label}
                className="grid border-b last:border-b-0"
                style={{ gridTemplateColumns: gridTemplate, minWidth }}
              >
                <DesktopCell strong>{row.label}</DesktopCell>

                {rosterColumns.map((col, index) => {
                  const metric =
                    row.metrics.find((m) => m.kpi_key === col.kpi_key) ?? null;

                  return (
                    <DesktopCell
                      key={col.kpi_key}
                      align="center"
                      className={sectionDividerClass(index)}
                    >
                      <DesktopMetricBadge
                        value={metric?.value ?? null}
                        band={metric?.band_key ?? null}
                        secondary={isSecondaryMetric(index)}
                      />
                    </DesktopCell>
                  );
                })}

                <DesktopCell align="center">
                  <DesktopCountBadge value={row.hc} />
                </DesktopCell>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}