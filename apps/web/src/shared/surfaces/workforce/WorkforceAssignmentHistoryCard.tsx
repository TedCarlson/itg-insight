// path: apps/web/src/shared/surfaces/workforce/WorkforceAssignmentHistoryCard.tsx

"use client";

import { useEffect, useState } from "react";

type AssignmentEventRow = {
  assignment_event_id: string;
  event_type: string;
  changed_by_app_user_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
};

type EditOptions = {
  offices?: { value: string; label: string }[];
  reportsTo?: {
    assignment_id: string;
    label: string;
  }[];
};

type Props = {
  assignmentId: string;
  editOptions?: EditOptions;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function labelForKey(key: string) {
  if (key === "position_title") return "Position";
  if (key === "office_id") return "Office";
  if (key === "reports_to_assignment_id") return "Reports To";
  if (key === "start_date") return "Start Date";
  if (key === "role_type") return "Seat";
  return key;
}

function resolveValue(key: string, value: unknown, options?: EditOptions) {
  if (!value) return "—";

  if (key === "office_id") {
    const match = options?.offices?.find((o) => o.value === value);
    return match?.label ?? String(value);
  }

  if (key === "reports_to_assignment_id") {
    const match = options?.reportsTo?.find((r) => r.assignment_id === value);
    return match?.label ?? String(value);
  }

  if (key === "role_type") {
    if (value === "FIELD") return "Field";
    if (value === "LEADERSHIP") return "Leadership";
    if (value === "SUPPORT") return "Support";
    if (value === "TRAVEL") return "Travel Tech";
    if (value === "FMLA") return "FMLA";
  }

  return String(value);
}

function summarizeChange(row: AssignmentEventRow, options?: EditOptions) {
  const entries = Object.entries(row.new_values ?? {}).filter(
    ([, value]) => value !== null && value !== undefined
  );

  if (entries.length === 0) {
    return ["Assignment updated"];
  }

  return entries.map(([key, newValue]) => {
    const oldValue = row.old_values?.[key];

    return `${labelForKey(key)}: ${resolveValue(
      key,
      oldValue,
      options
    )} → ${resolveValue(key, newValue, options)}`;
  });
}

export function WorkforceAssignmentHistoryCard({
  assignmentId,
  editOptions,
}: Props) {
  const [rows, setRows] = useState<AssignmentEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/workforce/assignment/history?assignment_id=${assignmentId}`
      );

      const json = await res.json().catch(() => null);

      if (cancelled) return;

      if (!res.ok) {
        setRows([]);
        setError(json?.error ?? "Unable to load history.");
        setLoading(false);
        return;
      }

      setRows(json?.rows ?? []);
      setLoading(false);
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  return (
    <div className="mt-4 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Assignment History</div>
        <div className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${rows.length} events`}
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_8%,white)] p-3 text-xs">
          {error}
        </div>
      ) : null}

      {!loading && rows.length === 0 && !error ? (
        <div className="mt-3 text-xs text-muted-foreground">
          No assignment history yet.
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div
              key={row.assignment_event_id}
              className="rounded-xl border bg-muted/30 p-3 text-xs"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{row.event_type}</span>
                <span className="text-muted-foreground">
                  {formatDate(row.created_at)}
                </span>
              </div>

              <div className="mt-2 space-y-1 text-muted-foreground">
                {summarizeChange(row, editOptions).map((line) => (
                  <div key={`${row.assignment_event_id}-${line}`}>{line}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}