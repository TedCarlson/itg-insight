"use client";

import { useMemo, useState } from "react";

import type { CompanySupervisorRosterRow } from "../lib/companySupervisorView.types";

export type CompanySupervisorPrimarySegment = "ALL" | "ITG" | "BP";

function numOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function avg(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function formatMetricValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/**
 * 🔥 Band styling (matches workforce)
 */
function bandClass(band?: string | null) {
  switch (band) {
    case "EXCEEDS":
    case "MEETS":
      return "border-green-500 text-green-700 bg-green-50";
    case "NEEDS_IMPROVEMENT":
      return "border-amber-500 text-amber-700 bg-amber-50";
    case "MISSES":
      return "border-red-500 text-red-700 bg-red-50";
    default:
      return "border-muted text-muted-foreground";
  }
}

type ParityRow = {
  key: string;
  label: string;
  headcount: number;
  jobs: number;
  installs: number;
  tcs: number;
  sros: number;
  metrics: Map<string, { value: number | null; band: string | null }>;
};

function buildParityRow(args: {
  key: string;
  label: string;
  rows: CompanySupervisorRosterRow[];
  rosterColumns: Array<{ kpi_key: string; label: string }>;
}): ParityRow {
  const { key, label, rows, rosterColumns } = args;

  let jobs = 0;
  let installs = 0;
  let tcs = 0;
  let sros = 0;

  for (const row of rows) {
    jobs += row.work_mix.total;
    installs += row.work_mix.installs;
    tcs += row.work_mix.tcs;
    sros += row.work_mix.sros;
  }

  const metrics = new Map<
    string,
    { value: number | null; band: string | null }
  >();

  for (const col of rosterColumns) {
    const values: number[] = [];
    const bands: Record<string, number> = {};

    for (const row of rows) {
      const metric = row.metrics.find((m) => m.kpi_key === col.kpi_key);
      const v = numOrNull(metric?.value ?? null);

      if (v != null) values.push(v);

      if (metric?.band_key) {
        bands[metric.band_key] = (bands[metric.band_key] || 0) + 1;
      }
    }

    const value = values.length
      ? values.reduce((s, n) => s + n, 0) / values.length
      : null;

    // dominant band
    const band =
      Object.entries(bands).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    metrics.set(col.kpi_key, { value, band });
  }

  return {
    key,
    label,
    headcount: rows.length,
    jobs,
    installs,
    tcs,
    sros,
    metrics,
  };
}

function HeaderCell(props: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  return (
    <div
      className={[
        "px-3 py-2 text-[11px] font-medium text-muted-foreground",
        props.align === "center" ? "text-center" : "text-left",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

function BodyCell(props: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  strong?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      className={[
        "px-3 py-2.5 text-sm",
        props.align === "center" ? "text-center" : "text-left",
        props.strong ? "font-semibold" : "",
        props.divider ? "border-l" : "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

export default function CompanySupervisorParityTable(props: {
  rows: CompanySupervisorRosterRow[];
  rosterColumns: Array<{ kpi_key: string; label: string }>;
  primarySegment: CompanySupervisorPrimarySegment;
  bpContractor: string;
}) {
  const { rows, rosterColumns, primarySegment, bpContractor } = props;

  const [showMix, setShowMix] = useState(false);

  const parityRows = useMemo(() => {
    if (primarySegment === "ITG") {
      const itgRows = rows.filter((r) => r.team_class === "ITG");
      return itgRows.length
        ? [buildParityRow({ key: "ITG", label: "ITG", rows: itgRows, rosterColumns })]
        : [];
    }

    if (primarySegment === "BP") {
      const bpRows = rows.filter((r) => r.team_class === "BP");

      if (bpContractor !== "ALL") {
        const rowsFiltered = bpRows.filter((r) => r.contractor_name === bpContractor);
        return rowsFiltered.length
          ? [buildParityRow({ key: bpContractor, label: bpContractor, rows: rowsFiltered, rosterColumns })]
          : [];
      }

      return [
        buildParityRow({ key: "BP", label: "BP", rows: bpRows, rosterColumns }),
      ];
    }

    return [
      buildParityRow({ key: "ALL", label: "ALL", rows, rosterColumns }),
      buildParityRow({
        key: "ITG",
        label: "ITG",
        rows: rows.filter((r) => r.team_class === "ITG"),
        rosterColumns,
      }),
      buildParityRow({
        key: "BP",
        label: "BP",
        rows: rows.filter((r) => r.team_class === "BP"),
        rosterColumns,
      }),
    ];
  }, [rows, rosterColumns, primarySegment, bpContractor]);

  const gridTemplate = `180px repeat(${rosterColumns.length}, minmax(84px, 1fr)) ${
    showMix ? "84px 84px 84px 84px" : ""
  } 72px`;

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Team Parity
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Admin-driven KPI order • quick scan by active workforce slice
          </div>
        </div>

        <button
          onClick={() => setShowMix((v) => !v)}
          className="text-xs border rounded-lg px-3 py-1 bg-muted/20 hover:bg-muted/40"
        >
          {showMix ? "Hide work mix" : "Show work mix +"}
        </button>
      </div>

      <div className="overflow-auto rounded-2xl border">
        <div
          className="grid border-b bg-muted/10"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <HeaderCell>Group</HeaderCell>

          {rosterColumns.map((c) => (
            <HeaderCell key={c.kpi_key} align="center">
              {c.label}
            </HeaderCell>
          ))}

          {showMix && (
            <>
              <HeaderCell align="center">Installs</HeaderCell>
              <HeaderCell align="center">TCs</HeaderCell>
              <HeaderCell align="center">SROs</HeaderCell>
              <HeaderCell align="center">Jobs</HeaderCell>
            </>
          )}

          <HeaderCell align="center">HC</HeaderCell>
        </div>

        {parityRows.map((row) => (
          <div
            key={row.key}
            className="grid border-b last:border-b-0"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <BodyCell strong>{row.label}</BodyCell>

            {rosterColumns.map((c) => {
              const metric = row.metrics.get(c.kpi_key);
              return (
                <BodyCell key={c.kpi_key} align="center">
                  <span
                    className={`inline-block rounded-md border px-2 py-0.5 text-xs ${bandClass(
                      metric?.band
                    )}`}
                  >
                    {formatMetricValue(metric?.value ?? null)}
                  </span>
                </BodyCell>
              );
            })}

            {showMix && (
              <>
                <BodyCell align="center" divider>{row.installs}</BodyCell>
                <BodyCell align="center">{row.tcs}</BodyCell>
                <BodyCell align="center">{row.sros}</BodyCell>
                <BodyCell align="center">{row.jobs}</BodyCell>
              </>
            )}

            <BodyCell align="center" divider>
              {row.headcount}
            </BodyCell>
          </div>
        ))}
      </div>
    </section>
  );
}