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

type AuditRow = {
  report_id: string;
  status: string;
  category_label: string | null;
  subcategory_label: string | null;
  job_number: string | null;
  job_type: string | null;
  evidence_badge?: string | null;
  submitted_at: string | null;
  last_action_at?: string | null;
  tech_full_name?: string | null;
  tech_id?: string | null;
  approved_by_full_name?: string | null;
  last_action_type?: string | null;
};

type AuditResponse = {
  ok: boolean;
  data?: {
    aging_open: AuditRow[];
    recent_closed: AuditRow[];
  };
  error?: string;
  meta?: {
    days?: number;
    recent_start_iso?: string;
  };
};

function getRowTime(row: AuditRow) {
  return row.last_action_at ?? row.submitted_at ?? null;
}

function sortRows(rows: AuditRow[]) {
  return rows.slice().sort((a, b) => {
    const prio = getPriority(a.status) - getPriority(b.status);
    if (prio !== 0) return prio;

    const aTime = getRowTime(a) ? new Date(getRowTime(a) as string).getTime() : 0;
    const bTime = getRowTime(b) ? new Date(getRowTime(b) as string).getTime() : 0;

    return bTime - aTime;
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No timestamp";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString();
}

function RowCard(props: { row: AuditRow; from: "audit-aging" | "audit-recent" }) {
  const { row, from } = props;
  const chip = getStatusChip(row.status, row.last_action_type);
  const borderClass = getStatusBorder(row.status, row.last_action_type);

  return (
    <Link
      href={`/field-log/${row.report_id}?from=${from}`}
      className={`block rounded-2xl border bg-card p-4 transition hover:bg-muted/40 ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold">{row.job_number ?? "Field Log"}</div>

          {row.tech_full_name || row.tech_id ? (
            <div className="mt-1 text-sm text-foreground">
              {row.tech_id ? `${row.tech_id} • ` : ""}
              {row.tech_full_name ?? "Unknown Technician"}
            </div>
          ) : null}

          <div className="mt-1 text-sm text-muted-foreground">
            {row.category_label ?? "Field Log"}
            {row.subcategory_label ? ` • ${row.subcategory_label}` : ""}
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
        {row.evidence_badge ?? "Evidence status unavailable"}
      </div>

      {row.approved_by_full_name ? (
        <div className="mt-2 text-sm text-muted-foreground">
          Finalized by {row.approved_by_full_name}
        </div>
      ) : null}

      <div className="mt-3 text-xs font-medium text-muted-foreground">
        Last activity: {formatDateTime(getRowTime(row))}
      </div>
    </Link>
  );
}

export function FieldLogAuditClient() {
  const { selectedOrgId } = useOrg();
  const [agingRows, setAgingRows] = useState<AuditRow[]>([]);
  const [recentRows, setRecentRows] = useState<AuditRow[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(
    async (showLoading = false) => {
      if (!selectedOrgId) {
        setAgingRows([]);
        setRecentRows([]);
        setLoading(false);
        return;
      }

      if (showLoading) setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set("pc_org_id", selectedOrgId);
        params.set("days", String(days));

        const res = await fetch(`/api/field-log/audit?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as AuditResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load audit queue.");
        }

        setAgingRows(sortRows(json.data?.aging_open ?? []));
        setRecentRows(sortRows(json.data?.recent_closed ?? []));
        setError(null);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit queue.");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [selectedOrgId, days],
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
    intervalMs: 30000,
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

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        Loading audit queue…
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
        title="Audit Queue"
        freshnessText={freshnessText}
        refreshing={refreshing}
        onRefresh={manualRefresh}
      />

      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold">Audit Window</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Recent finalized work plus all unresolved aging work.
            </div>
          </div>

          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full rounded-xl border px-3 py-3 text-sm md:w-[180px]"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </section>

      {!selectedOrgId ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          Select a PC scope to load the audit queue.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-amber-700">
                Aging / Unresolved
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                No date limit. These remain visible until resolved or manually closed.
              </div>
            </div>

            {agingRows.length === 0 ? (
              <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
                No unresolved aging items found.
              </div>
            ) : (
              <div className="space-y-3">
                {agingRows.map((row) => (
                  <RowCard key={row.report_id} row={row} from="audit-aging" />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-green-700">
                Recent Finalized
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Approved, closed, resolved, or rejected in the selected audit window.
              </div>
            </div>

            {recentRows.length === 0 ? (
              <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
                No finalized items found for this audit window.
              </div>
            ) : (
              <div className="space-y-3">
                {recentRows.map((row) => (
                  <RowCard key={row.report_id} row={row} from="audit-recent" />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
