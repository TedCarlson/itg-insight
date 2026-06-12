"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrg } from "@/state/org";
import { getStatusChip } from "../lib/statusStyles";

type ActivityRow = {
  report_id: string;
  status: string;
  category_key: string | null;
  category_label: string | null;
  subcategory_label: string | null;
  job_number: string | null;
  job_type: string | null;
  submitted_at: string | null;
  tech_full_name?: string | null;
  tech_id?: string | null;
  tech_office?: string | null;
  office?: string | null;
  evidence_badge?: string | null;
  last_action_type?: string | null;
};

type QueueResponse = {
  ok: boolean;
  data?: ActivityRow[];
  error?: string;
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function ageDays(value: string | null | undefined) {
  if (!value) return null;
  const submitted = new Date(value).getTime();
  if (Number.isNaN(submitted)) return null;

  const diffMs = Date.now() - submitted;
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function agingLabel(days: number | null) {
  if (days == null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function agingClass(days: number | null) {
  if (days == null) return "text-muted-foreground";
  if (days >= 7) return "text-red-700 font-semibold";
  if (days >= 3) return "text-amber-700 font-semibold";
  return "text-muted-foreground";
}

function groupLabel(row: ActivityRow) {
  if (row.category_key === "new_drop") return "New Drop";
  if (row.category_key === "conduit_pull_install") return "Conduit Pull on Install";
  return row.category_label ?? row.category_key ?? "Field Log";
}

function rowOffice(row: ActivityRow) {
  return row.tech_office ?? row.office ?? "—";
}

export function FieldLogActivityTable() {
  const { selectedOrgId } = useOrg();
  const [rows, setRows] = useState<ActivityRow[]>([]);
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

      const res = await fetch(`/api/field-log/queue?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res.json()) as QueueResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load Field Log activity.");
      }

      setRows(json.data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Field Log activity.");
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const qcAgingRows = useMemo(() => {
    return rows
      .filter((row) => row.category_key === "qc" && row.status === "pending_review")
      .slice()
      .sort((a, b) => {
        const aAge = ageDays(a.submitted_at) ?? -1;
        const bAge = ageDays(b.submitted_at) ?? -1;
        if (aAge !== bAge) return bAge - aAge;
        return String(a.job_number ?? "").localeCompare(String(b.job_number ?? ""));
      });
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();

    for (const row of rows) {
      const key = groupLabel(row);
      const existing = map.get(key) ?? [];
      existing.push(row);
      map.set(key, existing);
    }

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Active Field Log Activity</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Open review and follow-up items grouped by submission type.
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
          Select a PC scope to load activity.
        </div>
      ) : loading ? (
        <div className="mt-4 text-sm text-muted-foreground">Loading activity…</div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">
          No active Field Log items.
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {qcAgingRows.length > 0 ? (
            <section className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-amber-900">
                    QC Review Aging
                  </div>
                  <div className="mt-1 text-xs text-amber-800">
                    Pending QC submissions ordered by oldest review age.
                  </div>
                </div>
                <div className="text-xs font-semibold text-amber-900">
                  {qcAgingRows.length} open
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Job</th>
                      <th className="px-3 py-2 text-left">Tech</th>
                      <th className="px-3 py-2 text-left">Evidence</th>
                      <th className="px-3 py-2 text-left">Submitted</th>
                      <th className="px-3 py-2 text-left">Office</th>
                      <th className="px-3 py-2 text-left">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qcAgingRows.map((row, index) => {
                      const days = ageDays(row.submitted_at);

                      return (
                        <tr key={`aging:${row.report_id}:${index}`} className="border-t">
                          <td className="px-3 py-2">
                            <Link
                              href={`/field-log/${row.report_id}?from=review`}
                              className="font-semibold underline-offset-2 hover:underline"
                            >
                              {row.job_number ?? "—"}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {row.subcategory_label ?? row.job_type ?? "—"}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {row.tech_id ? `${row.tech_id} • ` : ""}
                            {row.tech_full_name ?? "—"}
                            <div className="text-xs text-muted-foreground">
                              Office: {rowOffice(row)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.evidence_badge ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {fmtDate(row.submitted_at)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {rowOffice(row)}
                          </td>
                          <td className={`px-3 py-2 ${agingClass(days)}`}>
                            {agingLabel(days)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {grouped.map(([label, groupRows]) => (
            <div key={label} className="space-y-2">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-xs text-muted-foreground">{groupRows.length}</div>
              </div>

              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Job</th>
                      <th className="px-3 py-2 text-left">Tech</th>
                      <th className="px-3 py-2 text-left">Checkpoint</th>
                      <th className="px-3 py-2 text-left">Evidence</th>
                      <th className="px-3 py-2 text-left">Submitted</th>
                      <th className="px-3 py-2 text-left">Office</th>
                      <th className="px-3 py-2 text-left">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupRows.map((row) => {
                      const chip = getStatusChip(row.status, row.last_action_type);

                      return (
                        <tr key={row.report_id} className="border-t">
                          <td className="px-3 py-2">
                            <Link
                              href={`/field-log/${row.report_id}?from=review`}
                              className="font-semibold underline-offset-2 hover:underline"
                            >
                              {row.job_number ?? "—"}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {row.subcategory_label ?? row.job_type ?? "—"}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {row.tech_id ? `${row.tech_id} • ` : ""}
                            {row.tech_full_name ?? "—"}
                            <div className="text-xs text-muted-foreground">
                              Office: {rowOffice(row)}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${chip.className}`}>
                              {chip.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.evidence_badge ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {fmtDate(row.submitted_at)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {rowOffice(row)}
                          </td>
                          <td className={`px-3 py-2 ${agingClass(ageDays(row.submitted_at))}`}>
                            {agingLabel(ageDays(row.submitted_at))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
