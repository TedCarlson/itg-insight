"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrg } from "@/state/org";

type SnapshotRow = {
  report_id: string;
  status: string;
  category_key: string | null;
  subcategory_key?: string | null;
  submitted_at: string | null;
  updated_at?: string | null;
  approved_at?: string | null;
  billing_prepared_at?: string | null;
  billing_email_sent_at?: string | null;
  billing_email_last_error?: string | null;
};

type SnapshotResponse = {
  ok: boolean;
  data?: SnapshotRow[];
  error?: string;
};

type LogSummary = {
  key: string;
  label: string;
  submitted: number;
  approved: number;
  rejected: number;
  unresolved: number;
  agingRisk: number;
  followup: number;
  openCases: number;
  tnpsOpen: number;
  billingPending: number;
  billingSent: number;
};

const ORDER = [
  "qc",
  "not_done",
  "u_code_applied",
  "new_drop",
  "conduit_pull_install",
  "post_call",
];

function labelFor(key: string) {
  if (key === "qc") return "QC";
  if (key === "not_done") return "Not Done";
  if (key === "u_code_applied") return "U-Code";
  if (key === "new_drop") return "New Drop";
  if (key === "conduit_pull_install") return "Conduit Pull";
  if (key === "post_call") return "Service Follow Up";
  return key.replaceAll("_", " ");
}

function isClosedStatus(status: string | null | undefined) {
  return status === "approved" || status === "closed" || status === "resolved" || status === "rejected";
}

function isPacketType(key: string) {
  return key === "new_drop" || key === "conduit_pull_install";
}

function isServiceFollowUp(row: SnapshotRow) {
  return row.category_key === "post_call";
}

function isTnps(row: SnapshotRow) {
  const sub = String(row.subcategory_key ?? "").toLowerCase();
  return isServiceFollowUp(row) && sub.includes("tnps");
}

function ageCalendarDays(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const then = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return Math.max(0, Math.floor((today - then) / 86400000));
}

function num(value: number) {
  return value > 0 ? String(value) : "—";
}

function rate(summary: LogSummary) {
  if (summary.submitted <= 0) return "—";
  const handled = summary.approved + summary.rejected;
  return `${Math.round((handled / summary.submitted) * 100)}%`;
}

function Metric(props: { label: string; value: string | number; emphasis?: boolean }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className={`mt-1 text-lg ${props.emphasis ? "font-semibold" : "font-medium"}`}>
        {props.value}
      </div>
    </div>
  );
}

function LogTypeCard({ summary }: { summary: LogSummary }) {
  if (isPacketType(summary.key)) {
    return (
      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">{summary.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Packet workflow: review, approve, reject, and billing email completion.
            </div>
          </div>
          <div className="rounded-full border px-2 py-1 text-xs font-semibold">
            {rate(summary)} handled
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <Metric label="Submitted" value={summary.submitted} emphasis />
          <Metric label="Approved" value={num(summary.approved)} />
          <Metric label="Rejected" value={num(summary.rejected)} emphasis={summary.rejected > 0} />
          <Metric label="Unresolved" value={num(summary.unresolved)} emphasis={summary.unresolved > 0} />
          <Metric label="Billing Pending" value={num(summary.billingPending)} emphasis={summary.billingPending > 0} />
          <Metric label="Billing Sent" value={num(summary.billingSent)} />
        </div>
      </section>
    );
  }

  if (summary.key === "post_call") {
    return (
      <section className="rounded-2xl border bg-card p-4">
        <div className="text-base font-semibold">{summary.label}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Case management: customer follow-up, tNPS, damage claims, and escalations.
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <Metric label="Submitted" value={summary.submitted} emphasis />
          <Metric label="Open Cases" value={num(summary.openCases)} emphasis={summary.openCases > 0} />
          <Metric label="tNPS Open" value={num(summary.tnpsOpen)} emphasis={summary.tnpsOpen > 0} />
          <Metric label="Closed" value={num(summary.approved)} />
          <Metric label="Aging 2d+" value={num(summary.agingRisk)} emphasis={summary.agingRisk > 0} />
          <Metric label="Handle Rate" value={rate(summary)} />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{summary.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Review workflow: submitted, handled, follow-up, and aging.
          </div>
        </div>
        <div className="rounded-full border px-2 py-1 text-xs font-semibold">
          {rate(summary)} handled
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Metric label="Submitted" value={summary.submitted} emphasis />
        <Metric label="Approved" value={num(summary.approved)} />
        <Metric label="Rejected" value={num(summary.rejected)} emphasis={summary.rejected > 0} />
        <Metric label="Unresolved" value={num(summary.unresolved)} emphasis={summary.unresolved > 0} />
        <Metric label="Follow-Up" value={num(summary.followup)} emphasis={summary.followup > 0} />
        <Metric label="Aging 2d+" value={num(summary.agingRisk)} emphasis={summary.agingRisk > 0} />
      </div>
    </section>
  );
}

export function FieldLogActivityTable() {
  const { selectedOrgId } = useOrg();
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("pc_org_id", selectedOrgId);
      params.set("days", "30");

      const res = await fetch(`/api/field-log/snapshot?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res.json()) as SnapshotResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load Field Log snapshot.");
      }

      setRows(json.data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Field Log snapshot.");
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summaries = useMemo(() => {
    const map = new Map<string, LogSummary>();

    function getSummary(row: SnapshotRow) {
      const key = row.category_key ?? "field_log";
      const existing = map.get(key);
      if (existing) return existing;

      const next: LogSummary = {
        key,
        label: labelFor(key),
        submitted: 0,
        approved: 0,
        rejected: 0,
        unresolved: 0,
        agingRisk: 0,
        followup: 0,
        openCases: 0,
        tnpsOpen: 0,
        billingPending: 0,
        billingSent: 0,
      };

      map.set(key, next);
      return next;
    }

    for (const row of rows) {
      const summary = getSummary(row);
      const key = row.category_key ?? "field_log";

      summary.submitted += 1;

      if (row.status === "approved" || row.status === "closed" || row.status === "resolved") {
        summary.approved += 1;
      }

      if (row.status === "rejected") summary.rejected += 1;
      if (!isClosedStatus(row.status)) summary.unresolved += 1;

      if (row.status === "tech_followup_required" || row.status === "sup_followup_required") {
        summary.followup += 1;
      }

      const age = ageCalendarDays(row.submitted_at ?? row.updated_at);
      if (!isClosedStatus(row.status) && age != null && age >= 2) summary.agingRisk += 1;

      if (key === "post_call" && !isClosedStatus(row.status)) {
        summary.openCases += 1;
        if (isTnps(row)) summary.tnpsOpen += 1;
      }

      if (isPacketType(key) && row.status === "approved") {
        if (row.billing_email_sent_at) {
          summary.billingSent += 1;
        } else {
          summary.billingPending += 1;
        }
      }
    }

    return Array.from(map.values())
      .filter((summary) => summary.submitted > 0)
      .sort((a, b) => {
        const ai = ORDER.indexOf(a.key);
        const bi = ORDER.indexOf(b.key);
        if (ai !== -1 || bi !== -1) {
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        }
        return a.label.localeCompare(b.label);
      });
  }, [rows]);

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Field Log Snapshot</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Thirty-day handling by log type. Each card shows only the signals relevant to that workflow.
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      {!selectedOrgId ? (
        <div className="mt-4 text-sm text-muted-foreground">
          Select a PC scope to load the snapshot.
        </div>
      ) : loading ? (
        <div className="mt-4 text-sm text-muted-foreground">Loading snapshot…</div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : summaries.length === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">
          No Field Log activity in the last 30 days.
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {summaries.map((summary) => (
            <LogTypeCard key={summary.key} summary={summary} />
          ))}
        </div>
      )}
    </section>
  );
}
