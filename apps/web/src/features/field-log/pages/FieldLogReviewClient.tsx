"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrg } from "@/state/org";
import { FieldLogLiveHeader } from "../components/FieldLogLiveHeader";
import { useFieldLogPolling } from "../hooks/useFieldLogPolling";
import { formatFreshness } from "../lib/freshness";
import {
  getPriority,
  getStatusBorder,
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
  submitted_at: string | null;
  tech_full_name?: string | null;
  tech_id?: string | null;
  approved_by_full_name?: string | null;
  last_action_type?: string | null;
};

type QueueResponse = {
  ok: boolean;
  data?: QueueRow[];
  error?: string;
  meta?: {
    mode?: "today" | "day" | "search" | "open";
    selected_day?: string | null;
    job_number?: string | null;
  };
};

function getSectionTextClass(status: string) {
  switch (status) {
    case "pending_review":
      return "text-blue-700";
    case "tech_followup_required":
      return "text-red-700";
    case "sup_followup_required":
      return "text-amber-700";
    case "approved":
      return "text-green-700";
    default:
      return "text-muted-foreground";
  }
}

function isReturnedForReview(lastActionType?: string | null) {
  return !!lastActionType && lastActionType.toLowerCase().includes("resubmit");
}

function isServiceFollowUp(row: QueueRow) {
  return row.category_key === "post_call" || row.category_label === "Service Follow Up";
}

function isTnpsEvent(row: QueueRow) {
  if (!isServiceFollowUp(row)) return false;

  const key = (row.subcategory_key ?? "").toLowerCase();
  const label = (row.subcategory_label ?? "").toLowerCase();

  return key.includes("tnps") || label.includes("tnps");
}

function normalizedCaseStatus(row: QueueRow) {
  return row.case_status ?? (row.status === "approved" ? "closed" : "open");
}

function isClosedCase(row: QueueRow) {
  const caseStatus = normalizedCaseStatus(row);
  return caseStatus === "closed" || row.status === "approved";
}

function niceCaseStatus(value: string | null | undefined) {
  const next = value ?? "open";
  return next.replaceAll("_", " ").toUpperCase();
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function prettyDay(day: string | null) {
  if (!day) return "Today";
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString();
}

export function FieldLogReviewClient() {
  const { selectedOrgId } = useOrg();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);
  const [jobSearchInput, setJobSearchInput] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState(todayYmd());
  const [mode, setMode] = useState<"today" | "day" | "search" | "open">("open");

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

        const trimmedJob = jobSearch.trim();
        if (trimmedJob) {
          params.set("jobNumber", trimmedJob);
        } else if (selectedDay !== todayYmd()) {
          params.set("day", selectedDay);
        }

        const res = await fetch(`/api/field-log/queue?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as QueueResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load review queue.");
        }

        const nextRows = (json.data ?? []).slice().sort((a, b) => {
          const prio = getPriority(a.status) - getPriority(b.status);
          if (prio !== 0) return prio;

          const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
          const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
          return bTime - aTime;
        });

        setRows(nextRows);
        setMode(json.meta?.mode ?? "today");
        setError(null);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load review queue.");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [selectedOrgId, selectedDay, jobSearch],
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

  const grouped = useMemo(() => {
    const normalRows = rows.filter((r) => !isServiceFollowUp(r));
    const serviceRows = rows.filter((r) => isServiceFollowUp(r));

    return {
      open_cases: serviceRows.filter((r) => !isClosedCase(r)),
      tnps_events: serviceRows.filter((r) => isTnpsEvent(r)),
      closed_cases: serviceRows.filter((r) => isClosedCase(r)),
      pending_review: normalRows.filter((r) => r.status === "pending_review"),
      tech_followup_required: normalRows.filter((r) => r.status === "tech_followup_required"),
      sup_followup_required: normalRows.filter((r) => r.status === "sup_followup_required"),
      approved: normalRows.filter((r) => r.status === "approved"),
    };
  }, [rows]);

  const freshnessText = useMemo(() => formatFreshness(lastUpdatedAt), [lastUpdatedAt]);

  const scopeText = useMemo(() => {
    if (mode === "search") return "Searching last 35 days";
    if (mode === "open") return "Showing all open review items";
    if (selectedDay === todayYmd()) return "Showing today";
    return `Showing ${prettyDay(selectedDay)}`;
  }, [mode, selectedDay]);

  function runSearch() {
    setJobSearch(jobSearchInput.trim());
  }

  function clearSearch() {
    setJobSearchInput("");
    setJobSearch("");
  }

  function Section(props: { title: string; rows: QueueRow[]; status: string }) {
    const { title, rows, status } = props;

    if (rows.length === 0) return null;

    return (
      <section className="space-y-3">
        <div className={`text-sm font-semibold ${getSectionTextClass(status)}`}>{title}</div>

        {rows.map((row) => {
          const serviceFollowUp = isServiceFollowUp(row);
          const chip = getStatusChip(row.status, row.last_action_type);
          const borderClass = getStatusBorder(row.status, row.last_action_type);
          const showClosedBy = row.status === "approved" && !!row.approved_by_full_name;
          const showReturnedTag =
            row.status === "pending_review" && isReturnedForReview(row.last_action_type);

          return (
            <Link
              key={row.report_id}
              href={`/field-log/${row.report_id}?from=review`}
              className={`block rounded-2xl border bg-card p-4 transition hover:bg-muted/40 ${borderClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold">{row.job_number}</div>

                  {row.tech_full_name || row.tech_id ? (
                    <div className="mt-1 text-sm text-foreground">
                      {row.tech_id ? `${row.tech_id} • ` : ""}
                      {row.tech_full_name ?? "Unknown Technician"}
                    </div>
                  ) : null}

                  <div className="mt-1 text-sm text-muted-foreground">
                    {row.category_label ?? "Field Log"}
                    {row.subcategory_label ? ` • ${row.subcategory_label}` : ""}
                    {serviceFollowUp ? ` • ${niceCaseStatus(normalizedCaseStatus(row))}` : ""}
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
                {row.evidence_badge}
              </div>

              {showReturnedTag ? (
                <div className="mt-2 text-sm font-medium text-blue-700">
                  Returned from tech follow-up for review
                </div>
              ) : null}

              {showClosedBy ? (
                <div className="mt-2 text-sm text-muted-foreground">
                  Closed by {row.approved_by_full_name}
                </div>
              ) : null}

              <div className="mt-3 text-xs font-medium text-muted-foreground">
                {serviceFollowUp ? "Opens case detail" : "Opens review detail"}
              </div>
            </Link>
          );
        })}
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
    <div className="space-y-4">
      <FieldLogLiveHeader
        title="Review Queue"
        freshnessText={freshnessText}
        refreshing={refreshing}
        onRefresh={manualRefresh}
      />

      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto_auto]">
          <input
            value={jobSearchInput}
            onChange={(e) => setJobSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
            placeholder="Search job number"
            className="w-full rounded-xl border px-3 py-3"
          />

          <input
            type="date"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value || todayYmd())}
            disabled={jobSearch.trim().length > 0}
            className="w-full rounded-xl border px-3 py-3 disabled:opacity-60"
          />

          <button
            type="button"
            onClick={runSearch}
            className="rounded-xl border px-4 py-3 text-sm font-medium hover:bg-muted"
          >
            Search
          </button>

          <button
            type="button"
            onClick={clearSearch}
            className="rounded-xl border px-4 py-3 text-sm font-medium hover:bg-muted"
          >
            Today
          </button>
        </div>

        <div className="text-sm text-muted-foreground">{scopeText}</div>
      </section>

      {!selectedOrgId ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          Select a PC scope to load the review queue.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          No items found for the current queue slice.
        </div>
      ) : (
        <div className="space-y-5">
          <Section title="Open Cases" rows={grouped.open_cases} status="sup_followup_required" />
          <Section title="tNPS Events" rows={grouped.tnps_events} status="pending_review" />
          <Section title="Pending Review" rows={grouped.pending_review} status="pending_review" />
          <Section
            title="Technician Follow-Up"
            rows={grouped.tech_followup_required}
            status="tech_followup_required"
          />
          <Section
            title="Supervisor Follow-Up"
            rows={grouped.sup_followup_required}
            status="sup_followup_required"
          />
          <Section title="Closed Cases" rows={grouped.closed_cases} status="approved" />
          <Section title="Closed / Finalized" rows={grouped.approved} status="approved" />
        </div>
      )}
    </div>
  );
}