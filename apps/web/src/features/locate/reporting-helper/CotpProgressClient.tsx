"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

type Column = {
  key: string;
  label: string;
  week_ending_date: string | null;
  record_id: string | null;
  created_at: string | null;
};

type StateRow = {
  state: string;
  values: Record<string, number>;
  reported_latest_day: boolean;
};

type Payload = {
  from: string;
  to: string;
  columns: Column[];
  state_rows: StateRow[];
  summary: {
    states: number;
    days: number;
    latest_day: string | null;
    latest_day_reported_states: number;
  };
};

type ReportingFilter = "ALL" | "REPORTED_LATEST" | "MISSING_LATEST";

function nyDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const base = new Date(`${year}-${month}-${day}T12:00:00-04:00`);
  base.setDate(base.getDate() + offsetDays);
  const shifted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const shiftedYear = shifted.find((part) => part.type === "year")?.value;
  const shiftedMonth = shifted.find((part) => part.type === "month")?.value;
  const shiftedDay = shifted.find((part) => part.type === "day")?.value;
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
}

function pct(value: number | null | undefined) {
  return value == null ? "—" : `${value}%`;
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function matrixRows(payload: Payload, rows: StateRow[]) {
  return [
    ["State", ...payload.columns.map((column) => column.label)],
    ...rows.map((row) => [row.state, ...payload.columns.map((column) => pct(row.values[column.key]))]),
  ];
}

function downloadBlob(contents: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CotpProgressClient() {
  const [from, setFrom] = useState(() => nyDate(-13));
  const [to, setTo] = useState(() => nyDate());
  const [appliedFrom, setAppliedFrom] = useState(() => nyDate(-13));
  const [appliedTo, setAppliedTo] = useState(() => nyDate());
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [reportingFilter, setReportingFilter] = useState<ReportingFilter>("ALL");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from: appliedFrom, to: appliedTo });
        const response = await fetch(`/api/locate/reporting-helper/progress/cotp?${params.toString()}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Failed to load COTP day-by-day report");
        if (!cancelled) setPayload(json);
      } catch (loadError: any) {
        if (!cancelled) setError(loadError?.message ?? "Failed to load report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [appliedFrom, appliedTo]);

  const visibleRows = useMemo(() => {
    const normalized = stateFilter.trim().toUpperCase();
    return (payload?.state_rows ?? []).filter((row) => {
      if (normalized && !row.state.includes(normalized)) return false;
      if (reportingFilter === "REPORTED_LATEST" && !row.reported_latest_day) return false;
      if (reportingFilter === "MISSING_LATEST" && row.reported_latest_day) return false;
      return true;
    });
  }, [payload, stateFilter, reportingFilter]);

  function applyRange() {
    if (from > to) {
      setError("From date must be on or before To date");
      return;
    }
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  function copyMatrix() {
    if (!payload) return;
    const text = matrixRows(payload, visibleRows).map((row) => row.join("\t")).join("\n");
    void navigator.clipboard.writeText(text);
  }

  function exportCsv() {
    if (!payload) return;
    const csv = matrixRows(payload, visibleRows)
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    downloadBlob(csv, "text/csv;charset=utf-8", `cotp-day-by-day-${appliedFrom}-to-${appliedTo}.csv`);
  }

  function exportXlsx() {
    if (!payload) return;
    const params = new URLSearchParams({
      from: appliedFrom,
      to: appliedTo,
      reporting: reportingFilter,
      states: visibleRows.map((row) => row.state).join(","),
    });
    window.location.href = `/api/locate/reporting-helper/progress/cotp/export/xlsx?${params.toString()}`;
  }

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">From Date</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-md border px-3 py-2"
              style={{ borderColor: "var(--to-border)" }}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">To Date</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-md border px-3 py-2"
              style={{ borderColor: "var(--to-border)" }}
            />
          </label>

          <button type="button" onClick={applyRange} className="to-btn rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: "var(--to-border)" }}>
            Apply
          </button>

          <label className="grid min-w-40 gap-1 text-sm">
            <span className="font-medium">State</span>
            <input
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
              placeholder="All states"
              className="rounded-md border px-3 py-2"
              style={{ borderColor: "var(--to-border)" }}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Reporting</span>
            <select
              value={reportingFilter}
              onChange={(event) => setReportingFilter(event.target.value as ReportingFilter)}
              className="rounded-md border px-3 py-2"
              style={{ borderColor: "var(--to-border)" }}
            >
              <option value="ALL">All states</option>
              <option value="REPORTED_LATEST">Reported latest day</option>
              <option value="MISSING_LATEST">Missing latest day</option>
            </select>
          </label>

          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" disabled={!payload} onClick={copyMatrix} className="to-btn rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--to-border)" }}>
              Copy
            </button>
            <button type="button" disabled={!payload} onClick={exportCsv} className="to-btn rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--to-border)" }}>
              CSV
            </button>
            <button type="button" disabled={!payload} onClick={exportXlsx} className="to-btn rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--to-border)" }}>
              Excel
            </button>
          </div>
        </div>
      </Card>

      {error ? <Card><div className="text-sm text-[var(--to-danger)]">{error}</div></Card> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="text-sm text-[var(--to-ink-muted)]">Selected Range</div>
          <div className="mt-2 text-xl font-semibold">{appliedFrom} → {appliedTo}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--to-ink-muted)]">Report Days</div>
          <div className="mt-2 text-3xl font-semibold">{payload?.summary.days ?? "—"}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--to-ink-muted)]">States Shown</div>
          <div className="mt-2 text-3xl font-semibold">{payload ? visibleRows.length : "—"}</div>
        </Card>
      </div>

      <Card>
        <div className="mb-3">
          <div className="text-base font-semibold">COTP Day by Day</div>
          <div className="text-sm text-[var(--to-ink-muted)]">
            Each column is the report-created date. Each value is that day&apos;s latest available week-end actual.
          </div>
        </div>

        <div className="overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}>
          <table className="w-full text-sm">
            <thead className="bg-[var(--to-surface-2)]">
              <tr>
                <th className="sticky left-0 z-10 bg-[var(--to-surface-2)] px-3 py-2 text-left">State</th>
                {(payload?.columns ?? []).map((column) => (
                  <th key={column.key} className="px-3 py-2 text-right whitespace-nowrap">{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? visibleRows.map((row) => (
                <tr key={row.state} className="border-t" style={{ borderColor: "var(--to-border)" }}>
                  <td className="sticky left-0 z-10 bg-[var(--to-surface-1)] px-3 py-2 font-semibold">{row.state}</td>
                  {(payload?.columns ?? []).map((column) => (
                    <td key={column.key} className="px-3 py-2 text-right">{pct(row.values[column.key])}</td>
                  ))}
                </tr>
              )) : (
                <tr>
                  <td colSpan={(payload?.columns.length ?? 0) + 1} className="px-3 py-8 text-center text-[var(--to-ink-muted)]">
                    {loading ? "Loading..." : "No COTP observations found for this range and filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
