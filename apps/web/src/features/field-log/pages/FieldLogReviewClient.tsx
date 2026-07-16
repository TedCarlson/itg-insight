"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrg } from "@/state/org";
import { FieldLogLiveHeader } from "../components/FieldLogLiveHeader";
import { useFieldLogPolling } from "../hooks/useFieldLogPolling";
import { formatFreshness } from "../lib/freshness";
import { FieldLogDetailClient } from "./FieldLogDetailClient";
import type { FieldLogDetailPayload } from "../lib/fieldLogDetail.types";
import {
  getPriority,
  getStatusChip,
  niceStatus,
} from "../lib/statusStyles";

type QueueRow = {
  report_id: string;
  status: string;
  category_key?: string | null;
  category_label: string | null;
  subcategory_key?: string | null;
  subcategory_label: string | null;
  case_status?: string | null;
  job_number: string;
  job_type: string | null;
  evidence_badge: string;
  comment?: string | null;
  created_at?: string | null;
  submitted_at: string | null;
  updated_at?: string | null;
  tech_full_name?: string | null;
  tech_id?: string | null;
  approved_by_full_name?: string | null;
  last_action_type?: string | null;
  email_delivery?: { sent_at: string; report_updated_at: string } | null;
};

type QueueResponse = {
  ok: boolean;
  data?: QueueRow[];
  error?: string;
  meta?: {
    count?: number;
    limit?: number;
    offset?: number;
    has_more?: boolean;
  };
};

function isServiceFollowUp(row: QueueRow) {
  return row.category_key === "post_call" || row.category_label === "Service Follow Up";
}

function normalizedCaseStatus(row: QueueRow) {
  return row.case_status ?? (row.status === "approved" ? "closed" : "open");
}

function niceCaseStatus(value: string | null | undefined) {
  const next = value ?? "open";
  return next.replaceAll("_", " ").toUpperCase();
}

function formatGridDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function niceKey(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}



export function FieldLogReviewClient(props: {
  viewMode?: "review" | "cases" | "tnps";
  title?: string;
}) {
  const { viewMode = "review", title = "Review Queue" } = props;
  const { selectedOrgId } = useOrg();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);
  const [jobSearchInput, setJobSearchInput] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [resultMeta, setResultMeta] = useState<{ count: number; hasMore: boolean }>({ count: 0, hasMore: false });
  const [selectedDetail, setSelectedDetail] = useState<FieldLogDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [emailPreview, setEmailPreview] = useState<{ subject: string; text: string; html: string } | null>(null);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testSendMessage, setTestSendMessage] = useState<string | null>(null);
  const [cutoffPreview, setCutoffPreview] = useState<{ count: number; records: QueueRow[] } | null>(null);

  const load = useCallback(
    async (showLoading = false) => {
      if (!selectedOrgId) {
        setRows([]);
        setLoading(false);
        return;
      }

      if (showLoading) setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set("pc_org_id", selectedOrgId);
        params.set("view", viewMode);
        params.set("limit", "50");
        params.set("offset", "0");

        const trimmed = jobSearch.trim();
        if (trimmed) params.set("q", trimmed);

        const res = await fetch(`/api/field-log/search?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as QueueResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load Field Log records.");
        }

        const nextRows = (json.data ?? []).slice().sort((a, b) => {
          const prio = getPriority(a.status) - getPriority(b.status);
          if (prio !== 0) return prio;

          const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
          const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
          return bTime - aTime;
        });

        setRows(nextRows);
        setResultMeta({
          count: json.meta?.count ?? nextRows.length,
          hasMore: !!json.meta?.has_more,
        });
        setError(null);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Field Log records.");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [selectedOrgId, jobSearch, viewMode],
  );

  const manualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    void load(true);
  }, [load]);

  useFieldLogPolling({
    enabled: !!selectedOrgId,
    intervalMs: 20000,
    onTick: async () => {
      await load(false);
    },
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((v) => v + 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  const freshnessText = useMemo(() => formatFreshness(lastUpdatedAt), [lastUpdatedAt]);

  const scopeText = useMemo(() => {
    const prefix =
      viewMode === "cases"
        ? "Service Follow Up records"
        : viewMode === "tnps"
          ? "tNPS Service Follow Up records"
          : "review records";

    if (jobSearch.trim()) {
      return `Searching all ${prefix} for "${jobSearch.trim()}"`;
    }

    return `Showing latest ${Math.min(resultMeta.count, 50)} ${prefix}`;
  }, [jobSearch, resultMeta.count, viewMode]);

  function runSearch() {
    setJobSearch(jobSearchInput.trim());
  }

  function clearSearch() {
    setJobSearchInput("");
    setJobSearch("");
  }

  async function previewEmail() {
    if (!selectedOrgId || selectedEmailIds.length === 0) return;
    setEmailPreviewLoading(true);
    try {
      const res = await fetch("/api/field-log/tnps-email/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pcOrgId: selectedOrgId, reportIds: selectedEmailIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to build email preview.");
      setEmailPreview(json.data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to build email preview.");
    } finally {
      setEmailPreviewLoading(false);
    }
  }

  async function sendTestEmail() {
    if (!selectedOrgId || selectedEmailIds.length === 0) return;
    setTestSending(true);
    setTestSendMessage(null);
    try {
      const res = await fetch("/api/field-log/tnps-email/test-send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pcOrgId: selectedOrgId, reportIds: selectedEmailIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Test email failed.");
      setTestSendMessage(`Test sent to ${json.email}`);
    } catch (err) {
      setTestSendMessage(err instanceof Error ? err.message : "Test email failed.");
    } finally {
      setTestSending(false);
    }
  }

  async function runInitialCutoff(execute: boolean) {
    if (!selectedOrgId) return;
    const res = await fetch("/api/field-log/tnps-email/initial-cutoff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pcOrgId: selectedOrgId, execute }) });
    const json = await res.json();
    if (!res.ok || !json.ok) { setDetailError(json.error || "Cutoff operation failed."); return; }
    setCutoffPreview(json.data);
    if (json.data.executed) await load(false);
  }

  async function openRecord(row: QueueRow) {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.location.href = `/field-log/${row.report_id}?from=review`;
      return;
    }

    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(
        `/api/field-log/detail?reportId=${encodeURIComponent(row.report_id)}`,
        { method: "GET", cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || "Failed to load record detail.");
      }
      setSelectedDetail(json.data as FieldLogDetailPayload);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load record detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  function RecordsGrid({ rows, compact = false }: { rows: QueueRow[]; compact?: boolean }) {
    if (rows.length === 0) return null;

    return (
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-semibold">
            {viewMode === "tnps" ? "tNPS follow-up records" : title}
          </div>
          <div className="text-xs text-muted-foreground">{rows.length} records · newest first</div>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full border-collapse text-sm ${compact ? "min-w-[440px]" : "min-w-[1180px]"}`}>
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {viewMode === "tnps" && !compact ? <th className="w-10 px-3 py-2"><span className="sr-only">Select</span></th> : null}
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Record date</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Order / Job</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Tech ID</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Technician</th>
                {!compact ? <th className="whitespace-nowrap px-3 py-2 font-semibold">{viewMode === "tnps" ? "Survey segment" : "Record type"}</th> : null}
                {!compact ? <th className="whitespace-nowrap px-3 py-2 font-semibold">Job type</th> : null}
                {!compact ? <th className="whitespace-nowrap px-3 py-2 font-semibold">Case</th> : null}
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Workflow</th>
                {!compact ? <th className="px-3 py-2 font-semibold">Detail</th> : null}
                {viewMode === "tnps" && !compact ? <th className="whitespace-nowrap px-3 py-2 font-semibold">Email status</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const chip = getStatusChip(row.status, row.last_action_type);
                return (
                  <tr
                    key={row.report_id}
                    tabIndex={0}
                    onClick={() => void openRecord(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") void openRecord(row);
                    }}
                    className="cursor-pointer border-t align-top hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
                  >
                    {viewMode === "tnps" && !compact ? <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedEmailIds.includes(row.report_id)}
                        onChange={(event) => setSelectedEmailIds((current) => event.target.checked ? [...current, row.report_id] : current.filter((id) => id !== row.report_id))}
                        aria-label={`Select job ${row.job_number} for email`}
                      />
                    </td> : null}
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                      {formatGridDate(row.submitted_at ?? row.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{row.job_number}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium">{row.tech_id ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.tech_full_name ?? "—"}</td>
                    {!compact ? <td className="whitespace-nowrap px-3 py-2.5">{niceKey(row.subcategory_key ?? row.category_key)}</td> : null}
                    {!compact ? <td className="whitespace-nowrap px-3 py-2.5 uppercase">{row.job_type ?? "—"}</td> : null}
                    {!compact ? <td className="whitespace-nowrap px-3 py-2.5">{isServiceFollowUp(row) ? niceCaseStatus(normalizedCaseStatus(row)) : "—"}</td> : null}
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${chip.className}`}>
                        {niceStatus(row.status)}
                      </span>
                    </td>
                    {!compact ? <td className="max-w-[320px] px-3 py-2.5 text-muted-foreground">
                      <div className="line-clamp-2">{row.comment?.trim() || "—"}</div>
                    </td> : null}
                    {viewMode === "tnps" && !compact ? <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      {!row.email_delivery ? "Never sent" : new Date(row.updated_at ?? row.submitted_at ?? 0).getTime() > new Date(row.email_delivery.report_updated_at).getTime() ? (
                        <span className="font-semibold text-amber-700">Updated since email</span>
                      ) : `Sent ${formatGridDate(row.email_delivery.sent_at)}`}
                    </td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        Loading review queue…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FieldLogLiveHeader
        title={title}
        freshnessText={freshnessText}
        refreshing={refreshing}
        onRefresh={manualRefresh}
      />

      <section className="flex flex-col gap-2 border-b pb-3">
        <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto]">
          <input
            value={jobSearchInput}
            onChange={(e) => setJobSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
            placeholder="Search job, tech ID, tech name, or comment"
            className="h-9 w-full rounded-lg border px-3 text-sm"
          />

          <button
            type="button"
            onClick={runSearch}
            className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted"
          >
            Search
          </button>

          <button
            type="button"
            onClick={clearSearch}
            className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted"
          >
            Reset
          </button>
        </div>

        <div className="text-xs text-muted-foreground">{scopeText}</div>
        {viewMode === "tnps" ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelectedEmailIds(rows.map((row) => row.report_id))} className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">Select queue</button>
            <button type="button" onClick={() => setSelectedEmailIds([])} className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">Clear</button>
            <button type="button" onClick={() => void previewEmail()} disabled={selectedEmailIds.length === 0 || emailPreviewLoading} className="rounded-lg border border-blue-400 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50">
              {emailPreviewLoading ? "Preparing…" : `Preview email (${selectedEmailIds.length})`}
            </button>
            <button type="button" onClick={() => void runInitialCutoff(false)} className="ml-auto rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">Review initial cutoff</button>
          </div>
        ) : null}
      </section>

      {viewMode === "tnps" && cutoffPreview ? <section className="rounded-xl border bg-card p-3 text-sm">
        <div className="flex items-center justify-between gap-3"><div><strong>{cutoffPreview.count}</strong> active cases submitted before July 12, 2026</div><div className="flex gap-2">{cutoffPreview.count > 0 ? <button type="button" onClick={() => void runInitialCutoff(true)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">Confirm close</button> : null}<button type="button" onClick={() => setCutoffPreview(null)} className="rounded-lg border px-3 py-1.5 text-xs">Dismiss</button></div></div>
        {cutoffPreview.count > 0 ? <div className="mt-2 text-xs text-muted-foreground">{cutoffPreview.records.map((row) => row.job_number).join(", ")}</div> : null}
      </section> : null}

      {viewMode === "tnps" && emailPreview ? (
        <section className="rounded-xl border bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><div className="text-xs text-muted-foreground">Subject</div><div className="text-sm font-semibold">{emailPreview.subject}</div></div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void navigator.clipboard.writeText(`Subject: ${emailPreview.subject}\n\n${emailPreview.text}`)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Copy email</button>
              <button type="button" onClick={() => void sendTestEmail()} disabled={testSending} className="rounded-lg border border-blue-400 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50">{testSending ? "Sending…" : "Send test to me"}</button>
              <button type="button" onClick={() => setEmailPreview(null)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Close</button>
            </div>
          </div>
          {testSendMessage ? <div className="mb-2 text-xs font-medium">{testSendMessage}</div> : null}
          <iframe
            title="tNPS email preview"
            srcDoc={emailPreview.html}
            className="h-80 w-full rounded-lg border bg-white"
            sandbox=""
          />
        </section>
      ) : null}

      {!selectedOrgId ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          Select a PC scope to load the review queue.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          No items found for the current queue slice.
        </div>
      ) : (
        <div className={selectedDetail ? "grid gap-4 lg:grid-cols-[minmax(420px,0.8fr)_minmax(0,2.2fr)]" : ""}>
          <RecordsGrid rows={rows} compact={!!selectedDetail} />

          {selectedDetail || detailLoading || detailError ? (
            <aside className="min-w-0 rounded-2xl border bg-background p-3">
              <div className="mb-3 flex items-center justify-between border-b pb-3">
                <div className="text-sm font-semibold">Review panel</div>
                <button type="button" onClick={() => setSelectedDetail(null)} className="rounded-lg border px-2.5 py-1 text-xs font-semibold">Close</button>
              </div>
              {detailLoading ? <div className="p-4 text-sm text-muted-foreground">Loading record…</div> : null}
              {detailError ? <div className="p-4 text-sm text-red-700">{detailError}</div> : null}
              {selectedDetail && !detailLoading ? <FieldLogDetailClient initialData={selectedDetail} /> : null}
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}
