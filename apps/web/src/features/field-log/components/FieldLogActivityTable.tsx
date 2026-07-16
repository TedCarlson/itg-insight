"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

function hrefFor(summary: LogSummary) {
  if (summary.key === "post_call") return "/field-log/cases";
  if (isPacketType(summary.key)) return "/field-log/new-drop-report";
  return "/field-log/review";
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

  const totals = useMemo(() => {
    const submitted = summaries.reduce((sum, item) => sum + item.submitted, 0);
    const handled = summaries.reduce((sum, item) => sum + item.approved + item.rejected, 0);
    const unresolved = summaries.reduce((sum, item) => sum + item.unresolved, 0);
    const followup = summaries.reduce((sum, item) => sum + item.followup + item.tnpsOpen, 0);
    const aging = summaries.reduce((sum, item) => sum + item.agingRisk, 0);
    return { submitted, handled, unresolved, followup, aging };
  }, [summaries]);

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="px-4 pt-4">
          <div className="text-base font-semibold">Field Log Snapshot</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Last 30 days · select a workflow to open its queue
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="mr-4 mt-4 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      {!selectedOrgId ? (
        <div className="p-4 text-sm text-muted-foreground">
          Select a PC scope to load the snapshot.
        </div>
      ) : loading ? (
        <div className="p-4 text-sm text-muted-foreground">Loading snapshot…</div>
      ) : error ? (
        <div className="m-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : summaries.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          No Field Log activity in the last 30 days.
        </div>
      ) : (
        <div className="mt-4">
          <div className="grid grid-cols-2 border-y bg-muted/20 sm:grid-cols-5">
            {[
              ["Submitted", totals.submitted],
              ["Handled", totals.handled],
              ["Open", totals.unresolved],
              ["Follow-up", totals.followup],
              ["Aging 2d+", totals.aging],
            ].map(([label, value]) => (
              <div key={label} className="border-r px-4 py-2 last:border-r-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="text-lg font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Workflow</th>
                  <th className="px-3 py-2 text-right font-medium">Submitted</th>
                  <th className="px-3 py-2 text-right font-medium">Handled</th>
                  <th className="px-3 py-2 text-right font-medium">Open</th>
                  <th className="px-3 py-2 text-right font-medium">Follow-up</th>
                  <th className="px-3 py-2 text-right font-medium">Aging 2d+</th>
                  <th className="px-3 py-2 text-right font-medium">Billing / tNPS</th>
                  <th className="px-4 py-2 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summaries.map((summary) => {
                  const handled = summary.approved + summary.rejected;
                  const special = summary.key === "post_call"
                    ? `${summary.tnpsOpen} tNPS open`
                    : isPacketType(summary.key)
                      ? `${summary.billingPending} pending`
                      : "—";

                  return (
                    <tr key={summary.key} className="transition hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={hrefFor(summary)} className="font-semibold hover:underline">
                          {summary.label}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{summary.submitted}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{num(handled)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${summary.unresolved ? "font-semibold" : ""}`}>{num(summary.unresolved)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{num(summary.followup)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${summary.agingRisk ? "text-amber-700" : ""}`}>{num(summary.agingRisk)}</td>
                      <td className="px-3 py-3 text-right text-xs text-muted-foreground">{special}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{rate(summary)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
