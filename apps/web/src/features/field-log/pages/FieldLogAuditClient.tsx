"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrg } from "@/state/org";
import { FieldLogLiveHeader } from "../components/FieldLogLiveHeader";
import { formatFreshness } from "../lib/freshness";
import { getStatusBorder, getStatusChip, niceStatus } from "../lib/statusStyles";

type HistoryRow = {
  report_id: string;
  status: string;
  category_key: string | null;
  subcategory_key: string | null;
  job_number: string | null;
  job_type: string | null;
  comment?: string | null;
  submitted_at: string | null;
  updated_at?: string | null;
  approved_at?: string | null;
  subject_full_name?: string | null;
  subject_tech_id?: string | null;
  billing_email_sent_at?: string | null;
};

type SearchResponse = {
  ok: boolean;
  data?: HistoryRow[];
  error?: string;
  meta?: {
    count?: number;
    limit?: number;
    offset?: number;
    has_more?: boolean;
  };
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No timestamp";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function labelForCategory(key: string | null | undefined) {
  if (key === "qc") return "QC";
  if (key === "not_done") return "Not Done";
  if (key === "u_code_applied") return "U-Code";
  if (key === "new_drop") return "New Drop";
  if (key === "conduit_pull_install") return "Conduit Pull";
  if (key === "post_call") return "Service Follow Up";
  return key ?? "Field Log";
}

function labelForSubcategory(key: string | null | undefined) {
  if (!key) return null;
  if (key === "detractor_risk") return "Customer Risk";
  if (key === "tnps_detractor") return "tNPS Detractor";
  if (key === "tnps_passive") return "tNPS Passive";
  if (key === "not_home_install") return "Not Home - Install";
  return key.replaceAll("_", " ");
}

function RowCard(props: { row: HistoryRow }) {
  const { row } = props;
  const chip = getStatusChip(row.status);
  const borderClass = getStatusBorder(row.status);

  const subLabel = labelForSubcategory(row.subcategory_key);

  return (
    <Link
      href={`/field-log/${row.report_id}?from=audit-recent`}
      className={`block rounded-2xl border bg-card p-4 transition hover:bg-muted/40 ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold">{row.job_number ?? "Field Log"}</div>

          {row.subject_full_name || row.subject_tech_id ? (
            <div className="mt-1 text-sm text-foreground">
              {row.subject_tech_id ? `${row.subject_tech_id} • ` : ""}
              {row.subject_full_name ?? "Unknown Technician"}
            </div>
          ) : null}

          <div className="mt-1 text-sm text-muted-foreground">
            {labelForCategory(row.category_key)}
            {subLabel ? ` • ${subLabel}` : ""}
          </div>
        </div>

        <div
          className={`inline-flex min-w-[44px] items-center justify-center rounded-full border px-2 py-1 text-xs font-semibold ${chip.className}`}
          title={niceStatus(row.status)}
        >
          {chip.label}
        </div>
      </div>

      <div className="mt-3 text-sm text-muted-foreground">
        {row.job_type ? `Job Type: ${row.job_type.toUpperCase()} • ` : ""}
        Submitted: {formatDateTime(row.submitted_at)}
      </div>

      {row.comment ? (
        <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {row.comment}
        </div>
      ) : null}

      <div className="mt-3 text-xs font-medium text-muted-foreground">
        Last activity: {formatDateTime(row.updated_at ?? row.approved_at ?? row.submitted_at)}
      </div>
    </Link>
  );
}

export function FieldLogAuditClient() {
  const { selectedOrgId } = useOrg();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [categoryKey, setCategoryKey] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [meta, setMeta] = useState({ count: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const load = useCallback(
    async (showLoading = false, nextOffset = 0, append = false) => {
      if (!selectedOrgId) {
        setRows([]);
        setLoading(false);
        return;
      }

      if (showLoading) setLoading(true);
      if (append) setLoadingMore(true);

      try {
        const params = new URLSearchParams();
        params.set("pc_org_id", selectedOrgId);
        params.set("view", "history");
        params.set("limit", "50");
        params.set("offset", String(nextOffset));

        if (query.trim()) params.set("q", query.trim());
        if (categoryKey) params.set("category_key", categoryKey);
        if (status) params.set("status", status);

        const res = await fetch(`/api/field-log/search?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as SearchResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load Field Log history.");
        }

        const nextRows = json.data ?? [];
        setRows((current) => (append ? [...current, ...nextRows] : nextRows));
        setOffset(nextOffset);
        setMeta({
          count: json.meta?.count ?? nextRows.length,
          hasMore: !!json.meta?.has_more,
        });
        setError(null);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Field Log history.");
      } finally {
        if (showLoading) setLoading(false);
        if (append) setLoadingMore(false);
      }
    },
    [selectedOrgId, query, categoryKey, status],
  );

  useEffect(() => {
    void load(true, 0, false);
  }, [load]);

  const freshnessText = useMemo(() => formatFreshness(lastUpdatedAt), [lastUpdatedAt]);

  function runSearch() {
    setQuery(queryInput.trim());
    setOffset(0);
  }

  function resetSearch() {
    setQueryInput("");
    setQuery("");
    setCategoryKey("");
    setStatus("");
    setOffset(0);
  }

  async function manualRefresh() {
    setRefreshing(true);
    try {
      await load(false, 0, false);
    } finally {
      setRefreshing(false);
    }
  }

  async function loadMore() {
    await load(false, offset + 50, true);
  }

  const scopeText = query.trim()
    ? `Searching all Field Logs for "${query.trim()}"`
    : `Showing latest ${rows.length} of ${meta.count} Field Logs`;

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        Loading Field Log history…
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
    <div className="space-y-4">
      <FieldLogLiveHeader
        title="Field Log History"
        freshnessText={freshnessText}
        refreshing={refreshing}
        onRefresh={manualRefresh}
      />

      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_auto_auto]">
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
            placeholder="Search job, tech ID, tech name, or comment"
            className="w-full rounded-xl border px-3 py-3"
          />

          <select
            value={categoryKey}
            onChange={(e) => {
              setCategoryKey(e.target.value);
              setOffset(0);
            }}
            className="w-full rounded-xl border px-3 py-3 text-sm"
          >
            <option value="">All Types</option>
            <option value="qc">QC</option>
            <option value="not_done">Not Done</option>
            <option value="u_code_applied">U-Code</option>
            <option value="new_drop">New Drop</option>
            <option value="conduit_pull_install">Conduit Pull</option>
            <option value="post_call">Service Follow Up</option>
          </select>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
            className="w-full rounded-xl border px-3 py-3 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending_review">Pending Review</option>
            <option value="tech_followup_required">Tech Follow-Up</option>
            <option value="sup_followup_required">Supervisor Follow-Up</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="closed">Closed</option>
          </select>

          <button
            type="button"
            onClick={runSearch}
            className="rounded-xl border px-4 py-3 text-sm font-medium hover:bg-muted"
          >
            Search
          </button>

          <button
            type="button"
            onClick={resetSearch}
            className="rounded-xl border px-4 py-3 text-sm font-medium hover:bg-muted"
          >
            Reset
          </button>
        </div>

        <div className="text-sm text-muted-foreground">{scopeText}</div>
      </section>

      {!selectedOrgId ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          Select a PC scope to load Field Log history.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          No Field Logs found.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <RowCard key={row.report_id} row={row} />
          ))}

          {meta.hasMore ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="w-full rounded-xl border bg-card px-4 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "Load Next 50"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
