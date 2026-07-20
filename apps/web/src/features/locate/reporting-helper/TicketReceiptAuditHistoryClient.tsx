"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

type HistoryRow = {
  record_id: string;
  report_type: "TICKET_RECEIPT_AUDIT";
  report_date: string | null;
  email_received_at: string | null;
  family: string | null;
  ticket_number: string | null;
  comment: string | null;
  source_as_of_at: string | null;
  created_at: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function TicketReceiptAuditHistoryClient() {
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
      const sp = new URLSearchParams({
        report_type: "TICKET_RECEIPT_AUDIT",
        pageIndex: String(pageIndex),
        pageSize: String(pageSize),
      });
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
    if (!window.confirm("Delete this saved Ticket Receipt Audit record?")) return;
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
          <h2 className="text-lg font-semibold">Ticket Receipt Audit History</h2>
          <p className="text-sm text-[var(--to-ink-muted)]">
            Saved ticket receipt audit records, presented independently from COTP reporting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/locate/reporting-helper" className="to-btn rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--to-border)" }}>
            New Report
          </Link>
          <button type="button" className="to-btn rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--to-border)" }} onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {err ? <Card><div className="text-sm text-[var(--to-danger)]">{err}</div></Card> : null}

      <Card>
        <div className="overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}>
          <table className="w-full text-sm">
            <thead className="bg-[var(--to-surface-2)]">
              <tr className="text-left">
                <th className="px-3 py-2">Email Received</th>
                <th className="px-3 py-2">Family</th>
                <th className="px-3 py-2">Ticket</th>
                <th className="px-3 py-2">Comment</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.record_id} className="border-t" style={{ borderColor: "var(--to-border)" }}>
                  <td className="px-3 py-2 whitespace-nowrap">{row.email_received_at ?? formatDateTime(row.source_as_of_at)}</td>
                  <td className="px-3 py-2 font-medium">{row.family ?? "—"}</td>
                  <td className="px-3 py-2 font-semibold">{row.ticket_number ?? "—"}</td>
                  <td className="px-3 py-2">{row.comment ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Link href={`/locate/reporting-helper/reports/${row.record_id}`} className="to-btn rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--to-border)" }}>
                        Open
                      </Link>
                      <button type="button" className="to-btn rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--to-danger)", color: "var(--to-danger)" }} onClick={() => void removeRecord(row.record_id)} disabled={loading}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-[var(--to-ink-muted)]">{loading ? "Loading…" : "No saved Ticket Receipt Audit records yet."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-[var(--to-ink-muted)]">Page {pageIndex + 1} • {totalRows} saved reports</div>
          <div className="flex gap-2">
            <button type="button" className="to-btn rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--to-border)" }} disabled={!canPrev || loading} onClick={() => setPageIndex((v) => Math.max(0, v - 1))}>Prev</button>
            <button type="button" className="to-btn rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--to-border)" }} disabled={!canNext || loading} onClick={() => setPageIndex((v) => v + 1)}>Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
