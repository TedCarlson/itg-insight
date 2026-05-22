"use client";

import { useMemo, useState } from "react";
import type { ExceptionRow } from "../hooks/useExceptions";

function statusLabel(row: ExceptionRow) {
  if (row.status) return row.status;
  return row.approved ? "APPROVED" : "PENDING";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function rowMatchesSearch(row: ExceptionRow, q: string) {
  const haystack = [
    row.shift_date,
    row.tech_id,
    row.exception_type,
    statusLabel(row),
    row.override_route_id,
    row.notes,
    row.decision_notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

export default function ExceptionsTable(props: {
  rows: ExceptionRow[];
  onApprove: (row: ExceptionRow, decisionNotes?: string) => Promise<void>;
  onDeny: (row: ExceptionRow, decisionNotes?: string) => Promise<void>;
}) {
  const { rows, onApprove, onDeny } = props;

  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, true>>({});
  const [error, setError] = useState<string | null>(null);
  const [statusSlice, setStatusSlice] = useState<"pending" | "approved">("pending");
  const [rangeSlice, setRangeSlice] = useState<"forward" | "all">("forward");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const today = todayIso();
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const status = statusLabel(row);
      const inStatus =
        statusSlice === "pending"
          ? status === "PENDING"
          : status === "APPROVED";

      const inRange = rangeSlice === "all" || String(row.shift_date ?? "") >= today;
      const inSearch = !q || rowMatchesSearch(row, q);

      return inStatus && inRange && inSearch;
    });
  }, [rows, search, statusSlice, rangeSlice]);

  const pendingRows = useMemo(
    () => filteredRows.filter((r) => statusLabel(r) === "PENDING"),
    [filteredRows]
  );

  const selectedPendingRows = useMemo(
    () => pendingRows.filter((r) => !!selectedIds[r.schedule_exception_day_id]),
    [pendingRows, selectedIds]
  );

  const allPendingSelected =
    pendingRows.length > 0 &&
    selectedPendingRows.length === pendingRows.length;

  const anySelected = selectedPendingRows.length > 0;
  const actionsDisabled = bulkBusy || busyId !== null;

  function toggleRow(row: ExceptionRow, checked: boolean) {
    const id = row.schedule_exception_day_id;
    const status = statusLabel(row);
    if (status !== "PENDING") return;

    setSelectedIds((prev) => {
      const next = { ...prev };
      if (checked) next[id] = true;
      else delete next[id];
      return next;
    });
  }

  function toggleAllPending(checked: boolean) {
    if (!pendingRows.length) {
      setSelectedIds({});
      return;
    }

    if (checked) {
      const next: Record<string, true> = {};
      for (const row of pendingRows) {
        next[row.schedule_exception_day_id] = true;
      }
      setSelectedIds(next);
      return;
    }

    setSelectedIds({});
  }

  async function handleApprove(row: ExceptionRow) {
    setBusyId(row.schedule_exception_day_id);
    setError(null);

    try {
      await onApprove(row);
      setSelectedIds((prev) => {
        const next = { ...prev };
        delete next[row.schedule_exception_day_id];
        return next;
      });
    } catch (err: any) {
      setError(String(err?.message ?? "Failed to approve exception"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeny(row: ExceptionRow) {
    setBusyId(row.schedule_exception_day_id);
    setError(null);

    try {
      const decisionNotes =
        window.prompt("Optional denial note:", row.decision_notes ?? "") ?? "";
      await onDeny(row, decisionNotes);
      setSelectedIds((prev) => {
        const next = { ...prev };
        delete next[row.schedule_exception_day_id];
        return next;
      });
    } catch (err: any) {
      setError(String(err?.message ?? "Failed to deny exception"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulkApprove() {
    if (!selectedPendingRows.length) return;

    setBulkBusy(true);
    setError(null);

    try {
      for (const row of selectedPendingRows) {
        await onApprove(row);
      }
      setSelectedIds({});
    } catch (err: any) {
      setError(String(err?.message ?? "Failed to bulk approve exceptions"));
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkDeny() {
    if (!selectedPendingRows.length) return;

    const decisionNotes =
      window.prompt("Optional denial note for selected rows:", "") ?? "";

    setBulkBusy(true);
    setError(null);

    try {
      for (const row of selectedPendingRows) {
        await onDeny(row, decisionNotes);
      }
      setSelectedIds({});
    } catch (err: any) {
      setError(String(err?.message ?? "Failed to bulk deny exceptions"));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <div className="text-sm text-[var(--to-danger,#b91c1c)]">{error}</div> : null}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[var(--to-border)] bg-[var(--to-surface-2)] px-3 py-2">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-[var(--to-ink-muted)]">Search</div>
            <input
              className="to-input h-8 w-[min(320px,60vw)] text-xs"
              placeholder="date, tech, type, route, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-xs text-[var(--to-ink-muted)]">Status</div>
            <select
              className="to-select h-8 text-xs"
              value={statusSlice}
              onChange={(e) => {
                setSelectedIds({});
                setStatusSlice(e.target.value as "pending" | "approved");
              }}
            >
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-xs text-[var(--to-ink-muted)]">Range</div>
            <select
              className="to-select h-8 text-xs"
              value={rangeSlice}
              onChange={(e) => setRangeSlice(e.target.value as "forward" | "all")}
            >
              <option value="forward">Today Forward</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="pb-1 text-sm text-[var(--to-ink-muted)]">
            Showing <span className="font-medium text-[var(--to-ink)]">{filteredRows.length}</span> of{" "}
            <span className="font-medium text-[var(--to-ink)]">{rows.length}</span>
            {statusSlice === "pending" ? (
              <>
                {" "}• {pendingRows.length} pending available
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!anySelected || actionsDisabled}
            onClick={handleBulkApprove}
            className="rounded-lg border px-3 py-1.5 text-xs hover:bg-[var(--to-surface)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkBusy ? "Working..." : `Approve Selected${anySelected ? ` (${selectedPendingRows.length})` : ""}`}
          </button>

          <button
            type="button"
            disabled={!anySelected || actionsDisabled}
            onClick={handleBulkDeny}
            className="rounded-lg border px-3 py-1.5 text-xs hover:bg-[var(--to-surface)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkBusy ? "Working..." : `Deny Selected${anySelected ? ` (${selectedPendingRows.length})` : ""}`}
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-[var(--to-ink-muted)]">
          <tr>
            <th className="px-3 py-2">
              <input
                type="checkbox"
                aria-label="Select all pending exceptions"
                checked={allPendingSelected}
                onChange={(e) => toggleAllPending(e.target.checked)}
                disabled={!pendingRows.length || actionsDisabled}
              />
            </th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Tech</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Force Off</th>
            <th className="px-3 py-2">Override Route</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>

        <tbody>
          {filteredRows.map((r) => {
            const busy = busyId === r.schedule_exception_day_id || bulkBusy;
            const status = statusLabel(r);
            const pending = status === "PENDING";
            const checked = !!selectedIds[r.schedule_exception_day_id];

            return (
              <tr
                key={r.schedule_exception_day_id}
                className="border-t border-[var(--to-border)]"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select exception ${r.schedule_exception_day_id}`}
                    checked={checked}
                    disabled={!pending || actionsDisabled}
                    onChange={(e) => toggleRow(r, e.target.checked)}
                  />
                </td>
                <td className="px-3 py-2">{r.shift_date}</td>
                <td className="px-3 py-2">{r.tech_id}</td>
                <td className="px-3 py-2">{r.exception_type}</td>
                <td className="px-3 py-2">{r.force_off ? "Yes" : "-"}</td>
                <td className="px-3 py-2">{r.override_route_id ?? "-"}</td>
                <td className="px-3 py-2">{status}</td>
                <td className="px-3 py-2">
                  {pending ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleApprove(r)}
                        className="rounded-lg border px-3 py-1 text-xs hover:bg-[var(--to-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy ? "Working..." : "Approve"}
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeny(r)}
                        className="rounded-lg border px-3 py-1 text-xs hover:bg-[var(--to-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy ? "Working..." : "Deny"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[var(--to-ink-muted)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}