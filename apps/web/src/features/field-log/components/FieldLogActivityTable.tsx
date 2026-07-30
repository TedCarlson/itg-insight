"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrg } from "@/state/org";

type Interest =
  | "my_work"
  | "review"
  | "follow_up"
  | "cases"
  | "billing"
  | "aging"
  | "history";

type Summary = {
  submitted: number;
  handled: number;
  open: number;
  follow_up: number;
  aging: number;
  billing_pending: number;
};

type CategoryRollup = {
  key: string;
  submitted: number;
  approved: number;
  rejected: number;
  open: number;
  follow_up: number;
  aging: number;
  open_cases: number;
  tnps_open: number;
  billing_pending: number;
};

type WorkItem = {
  report_id: string;
  status: string;
  category_key: string;
  subcategory_key: string | null;
  job_number: string;
  subject_full_name: string | null;
  subject_tech_id: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  case_status: string | null;
};

type DashboardBatch = {
  summary: Summary;
  categories: CategoryRollup[];
  work_items: WorkItem[];
  meta: {
    interest: Interest;
    scope_mode: "self" | "org";
    window_days: number;
    limit: number;
  };
};

type DashboardResponse = {
  ok: boolean;
  scope?: {
    role: "technician" | "elevated";
    pc_org_id: string;
    mode: "self" | "org";
  };
  data?: DashboardBatch;
  error?: string;
};

const EMPTY_SUMMARY: Summary = {
  submitted: 0,
  handled: 0,
  open: 0,
  follow_up: 0,
  aging: 0,
  billing_pending: 0,
};

const INTERESTS: Array<{ key: Interest; label: string }> = [
  { key: "review", label: "Review" },
  { key: "follow_up", label: "Follow-up" },
  { key: "cases", label: "Cases" },
  { key: "billing", label: "Billing" },
  { key: "aging", label: "Aging" },
  { key: "history", label: "History" },
];

function categoryLabel(key: string) {
  if (key === "qc") return "QC";
  if (key === "not_done") return "Not Done";
  if (key === "u_code_applied") return "U-Code";
  if (key === "new_drop") return "New Drop";
  if (key === "conduit_pull_install") return "Conduit Pull";
  if (key === "commercial_battery_billing") return "Commercial Battery";
  if (key === "post_call") return "Service Follow Up";
  return key.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function niceStatus(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function FieldLogActivityTable() {
  const { selectedOrgId } = useOrg();
  const [interest, setInterest] = useState<Interest>("review");
  const [batch, setBatch] = useState<DashboardBatch | null>(null);
  const [scopeMode, setScopeMode] = useState<"self" | "org" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) {
      setBatch(null);
      setScopeMode(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        pc_org_id: selectedOrgId,
        interest,
      });
      const res = await fetch(`/api/field-log/dashboard-batch?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const json = (await res.json()) as DashboardResponse;

      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || "Failed to load Field Log dashboard.");
      }

      setBatch(json.data);
      setScopeMode(json.scope?.mode ?? json.data.meta.scope_mode);
      if (json.data.meta.interest !== interest) {
        setInterest(json.data.meta.interest);
      }
    } catch (err) {
      setBatch(null);
      setError(err instanceof Error ? err.message : "Failed to load Field Log dashboard.");
    } finally {
      setLoading(false);
    }
  }, [interest, selectedOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = batch?.summary ?? EMPTY_SUMMARY;
  const totals = useMemo(
    () => [
      ["Submitted", summary.submitted],
      ["Handled", summary.handled],
      ["Open", summary.open],
      ["Follow-up", summary.follow_up],
      ["Aging 2d+", summary.aging],
      ["Billing", summary.billing_pending],
    ],
    [summary],
  );

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-base font-semibold">Field Log Dashboard</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {scopeMode === "self" ? "My records" : "Selected organization"} · last 30 days · maximum 25 work items
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || !selectedOrgId}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {scopeMode !== "self" ? (
        <div className="mt-3 flex flex-wrap gap-1.5 px-4">
          {INTERESTS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setInterest(item.key)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                interest === item.key ? "border-blue-400 bg-blue-50 text-blue-800" : "hover:bg-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {!selectedOrgId ? (
        <div className="p-4 text-sm text-muted-foreground">Select a PC scope to load Field Log.</div>
      ) : error ? (
        <div className="m-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="mt-4">
          <div className="grid grid-cols-2 border-y bg-muted/20 sm:grid-cols-6">
            {totals.map(([label, value]) => (
              <div key={label} className="border-r px-4 py-2 last:border-r-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="text-lg font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
            <div className="overflow-hidden rounded-xl border">
              <div className="border-b bg-muted/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                Workflow totals
              </div>
              {batch?.categories.length ? (
                <div className="divide-y">
                  {batch.categories.map((category) => (
                    <div key={category.key} className="grid grid-cols-[minmax(0,1fr)_repeat(3,64px)] gap-2 px-3 py-2 text-sm">
                      <div className="font-medium">{categoryLabel(category.key)}</div>
                      <div className="text-right tabular-nums" title="Submitted">{category.submitted}</div>
                      <div className="text-right tabular-nums" title="Open">{category.open}</div>
                      <div className="text-right tabular-nums text-amber-700" title="Aging">{category.aging}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-sm text-muted-foreground">No activity in this scope.</div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border">
              <div className="border-b bg-muted/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                {scopeMode === "self" ? "My work" : INTERESTS.find((item) => item.key === interest)?.label} items
              </div>
              {batch?.work_items.length ? (
                <div className="divide-y">
                  {batch.work_items.map((item) => (
                    <Link
                      key={item.report_id}
                      href={`/field-log/${item.report_id}`}
                      className="block px-3 py-2 transition hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{item.job_number || "Field Log"}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {item.subject_full_name || item.subject_tech_id || categoryLabel(item.category_key)}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px]">
                          {niceStatus(item.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {formatDate(item.submitted_at ?? item.updated_at)}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-sm text-muted-foreground">No matching work items.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
