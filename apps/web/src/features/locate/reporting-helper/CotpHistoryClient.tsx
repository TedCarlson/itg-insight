"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

type HistoryRow = {
  record_id: string;
  report_type: string;
  week_ending_date: string | null;
  week_ending_label: string | null;
  overall_performance: number | null;
  state_count: number;
  needs_attention_count: number;
  watch_closely_count: number;
  source_as_of_at: string | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function CotpHistoryClient() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [totalRows, setTotalRows] = useState(0);

  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const sp = new URLSearchParams();
      sp.set("report_type", "COTP");
      sp.set("pageIndex", String(pageIndex));
      sp.set("pageSize", String(pageSize));

      const res = await fetch(`/api/locate/reporting-helper/history?${sp.toString()}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error ?? "Failed to load history");

      setRows(json.rows ?? []);
      setTotalRows(json.page?.totalRows ?? 0);
    } catch (error: any) {
      setErr(error?.message ?? "Failed to load history");
      setRows([]);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  }, [pageIndex]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeRecord(recordId: string) {
    const confirmed = window.confirm(
      "Delete this saved report? This will remove the historical record and its COTP detail rows."
    );

    if (!confirmed) return;

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/locate/reporting-helper/reports/${encodeURIComponent(recordId)}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Delete failed");

      await load();
    } catch (error: any) {
      setErr(error?.message ?? "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  const canPrev = pageIndex > 0;
  const canNext = useMemo(() => (pageIndex + 1) * pageSize < totalRows, [pageIndex, totalRows]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">COTP Report History</h2>
          <p className="text-sm text-[var(--to-ink-muted)]">
            Canonical saved reports from the Locate Reporting Helper.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/locate/reporting-helper"
            className="to-btn rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
          >
            New Report
          </Link>

          <button
            type="button"
            className="to-btn rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <Card>
          <div className="text-sm text-[var(--to-danger)]">{err}</div>
        </Card>
      ) : null}

      <Card>
        <div className="overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}>
          <table className="w-full text-sm">
            <thead className="bg-[var(--to-surface-2)]">
              <tr className="text-left">
                <th className="px-3 py-2">Week Ending</th>
                <th className="px-3 py-2 text-right">Overall</th>
                <th className="px-3 py-2 text-right">States</th>
                <th className="px-3 py-2 text-right">Needs Attention</th>
                <th className="px-3 py-2 text-right">Watch</th>
                <th className="px-3 py-2">As Of</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.record_id} className="border-t" style={{ borderColor: "var(--to-border)" }}>
                    <td className="px-3 py-2">
                      <div className="font-semibold">
                        {row.week_ending_label ?? formatDate(row.week_ending_date)}
                      </div>
                      <div className="text-xs text-[var(--to-ink-muted)]">
                        {row.week_ending_date ?? "No date"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {row.overall_performance == null ? "—" : `${row.overall_performance}%`}
                    </td>
                    <td className="px-3 py-2 text-right">{row.state_count}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={row.needs_attention_count ? "font-bold text-[var(--to-danger)]" : ""}>
                        {row.needs_attention_count}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{row.watch_closely_count}</td>
                    <td className="px-3 py-2">{formatDateTime(row.source_as_of_at)}</td>
                    <td className="px-3 py-2">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/locate/reporting-helper/reports/${row.record_id}`}
                          className="to-btn rounded border px-2 py-1 text-xs"
                          style={{ borderColor: "var(--to-border)" }}
                        >
                          Open
                        </Link>
                        <a
                          href={`/api/locate/reporting-helper/export/xlsx?record_id=${encodeURIComponent(row.record_id)}`}
                          className="to-btn rounded border px-2 py-1 text-xs"
                          style={{ borderColor: "var(--to-border)" }}
                        >
                          Excel
                        </a>
                        <button
                          type="button"
                          className="to-btn rounded border px-2 py-1 text-xs"
                          style={{ borderColor: "var(--to-danger)", color: "var(--to-danger)" }}
                          onClick={() => void removeRecord(row.record_id)}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-[var(--to-ink-muted)]">
                    {loading ? "Loading…" : "No saved reports yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-[var(--to-ink-muted)]">
            Page {pageIndex + 1} • {totalRows} saved reports
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="to-btn rounded border px-3 py-2 text-sm"
              style={{ borderColor: "var(--to-border)" }}
              disabled={!canPrev || loading}
              onClick={() => setPageIndex((v) => Math.max(0, v - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="to-btn rounded border px-3 py-2 text-sm"
              style={{ borderColor: "var(--to-border)" }}
              disabled={!canNext || loading}
              onClick={() => setPageIndex((v) => v + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
