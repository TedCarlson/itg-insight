"use client";

import { useState } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { useExceptions, type ExceptionRow } from "../hooks/useExceptions";
import ExceptionsTable from "../components/ExceptionsTable";
import CreateExceptionModal from "../components/CreateExceptionModal";

export default function ExceptionsPage() {
  const { rows, loading, error, reload } = useExceptions();
  const [open, setOpen] = useState(false);

  async function onApprove(row: ExceptionRow, decisionNotes?: string) {
    const res = await fetch("/api/route-lock/exceptions/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schedule_exception_day_id: row.schedule_exception_day_id,
        decision_notes: decisionNotes ?? null,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      throw new Error(String(json?.error ?? "Failed to approve exception"));
    }

    await reload();
  }

  async function onDeny(row: ExceptionRow, decisionNotes?: string) {
    const res = await fetch("/api/route-lock/exceptions/deny", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schedule_exception_day_id: row.schedule_exception_day_id,
        decision_notes: decisionNotes ?? null,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      throw new Error(String(json?.error ?? "Failed to deny exception"));
    }

    await reload();
  }

  return (
    <PageShell>
      <div className="rounded-2xl border bg-[var(--to-surface)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-[var(--to-ink-muted)]">Schedule Exceptions</div>

          <button
            className="rounded-lg border px-3 py-1 text-sm hover:bg-[var(--to-surface-2)]"
            onClick={() => setOpen(true)}
          >
            + Draft Exception Range
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-[var(--to-ink-muted)]">Loading exceptions...</div>
        ) : error ? (
          <div className="text-sm text-[var(--to-danger,#b91c1c)]">{error}</div>
        ) : (
          <ExceptionsTable rows={rows} onApprove={onApprove} onDeny={onDeny} />
        )}
      </div>

      {open ? (
        <CreateExceptionModal
          onClose={() => setOpen(false)}
          onCreated={() => reload()}
        />
      ) : null}
    </PageShell>
  );
}