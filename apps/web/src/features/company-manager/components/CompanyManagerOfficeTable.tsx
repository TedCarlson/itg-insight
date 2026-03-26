"use client";

import { useState } from "react";

import type { CompanyManagerOfficeRollupRow } from "../lib/companyManagerView.types";

type MetricColumn = {
  kpi_key: string;
  label: string;
};

function formatMetricValue(value: number | null) {
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

function getMetricColumns(row: CompanyManagerOfficeRollupRow): MetricColumn[] {
  return row.metric_order ?? [];
}

function getMetricSummary(row: CompanyManagerOfficeRollupRow, kpiKey: string) {
  return row.metrics.get(kpiKey) ?? null;
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

function DesktopWorkMixBadge(props: { value: number }) {
  return (
    <div className="inline-flex min-w-[58px] items-center justify-center rounded-md border border-[var(--to-border)] bg-muted/10 px-2 py-1 text-sm font-medium">
      {props.value}
    </div>
  );
}

export default function CompanyManagerOfficeTable(props: {
  rows: CompanyManagerOfficeRollupRow[];
  activeOffice: string | null;
  onSelectOffice: (office: string | null) => void;
}) {
  const { rows, activeOffice, onSelectOffice } = props;
  const [showMix, setShowMix] = useState(false);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border bg-muted/[0.04] p-4 text-sm text-muted-foreground">
        No office rows in scope.
      </div>
    );
  }

  const metricColumns = getMetricColumns(rows[0]);
  const gridTemplate = `180px repeat(${metricColumns.length}, minmax(84px, 1fr)) ${
    showMix ? "repeat(4, minmax(84px, 1fr)) " : ""
  }72px`;
  const minWidth = showMix ? "1380px" : "1040px";

  return (
    <div className="rounded-2xl border bg-muted/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          KPI order aligned to workforce performance
        </div>

        <button
          type="button"
          onClick={() => setShowMix((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
        >
          <span>{showMix ? "Hide work mix" : "Show work mix"}</span>
          <span className={`transition-transform ${showMix ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
      </div>

      <div className="overflow-auto rounded-2xl border">
        <div
          className="grid border-b bg-muted/10"
          style={{ gridTemplateColumns: gridTemplate, minWidth }}
        >
          <DesktopHeaderCell>Office</DesktopHeaderCell>

          {metricColumns.map((col: MetricColumn, index: number) => (
            <DesktopHeaderCell
              key={col.kpi_key}
              align="center"
              className={sectionDividerClass(index)}
            >
              {col.label}
            </DesktopHeaderCell>
          ))}

          {showMix ? (
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

          <DesktopHeaderCell align="center">HC</DesktopHeaderCell>
        </div>

        {rows.map((row) => {
          const active = activeOffice === row.office;

          return (
            <div
              key={row.office}
              onClick={() => onSelectOffice(active ? null : row.office)}
              className={[
                "grid cursor-pointer border-b last:border-b-0 transition",
                active
                  ? "bg-[color-mix(in_oklab,var(--to-accent)_10%,white)]"
                  : "hover:bg-muted/30",
              ].join(" ")}
              style={{ gridTemplateColumns: gridTemplate, minWidth }}
            >
              <DesktopCell strong>{row.office}</DesktopCell>

              {metricColumns.map((col: MetricColumn, index: number) => {
                const metric = getMetricSummary(row, col.kpi_key);

                return (
                  <DesktopCell
                    key={col.kpi_key}
                    align="center"
                    className={sectionDividerClass(index)}
                  >
                    <DesktopMetricBadge
                      value={metric?.value ?? null}
                      band={metric?.band ?? null}
                      secondary={isSecondaryMetric(index)}
                    />
                  </DesktopCell>
                );
              })}

              {showMix ? (
                <>
                  <DesktopCell
                    align="center"
                    className="border-l border-[var(--to-border)] pl-4"
                  >
                    <DesktopWorkMixBadge value={row.installs} />
                  </DesktopCell>
                  <DesktopCell align="center">
                    <DesktopWorkMixBadge value={row.tcs} />
                  </DesktopCell>
                  <DesktopCell align="center">
                    <DesktopWorkMixBadge value={row.sros} />
                  </DesktopCell>
                  <DesktopCell align="center">
                    <DesktopWorkMixBadge value={row.jobs} />
                  </DesktopCell>
                </>
              ) : null}

              <DesktopCell align="center">
                <DesktopWorkMixBadge value={row.headcount} />
              </DesktopCell>
            </div>
          );
        })}
      </div>
    </div>
  );
}