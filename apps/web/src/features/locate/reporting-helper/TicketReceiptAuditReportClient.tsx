"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { TicketReceiptAuditGeneratedReport } from "@/shared/server/locate/reporting-helper/reportingHelperTypes";

export function TicketReceiptAuditReportClient({
  recordId,
  record,
  report,
  onDelete,
}: {
  recordId: string;
  record: any;
  report: TicketReceiptAuditGeneratedReport;
  onDelete: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Saved Ticket Receipt Audit</h2>
          <p className="text-sm text-[var(--to-ink-muted)]">
            Ticket {report.ticketNumber ?? "—"} • Record {recordId}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/locate/reporting-helper/history/ticket-receipt-audit" className="to-btn rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--to-border)" }}>
            Back to History
          </Link>
          <button type="button" className="to-btn rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--to-danger)", color: "var(--to-danger)" }} onClick={onDelete}>
            Delete Report
          </button>
        </div>
      </div>

      <Card>
        <h3 className="mb-3 font-semibold">Audit Record</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Email received</dt><dd className="mt-1 text-sm font-medium">{report.emailReceivedAt ?? "—"}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Family</dt><dd className="mt-1 text-sm font-medium">{report.family || "—"}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Ticket number</dt><dd className="mt-1 text-sm font-semibold">{report.ticketNumber ?? "—"}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Comment</dt><dd className="mt-1 text-sm">{report.comment ?? "—"}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Saved</dt><dd className="mt-1 text-sm">{record?.created_at ? new Date(record.created_at).toLocaleString() : "—"}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Source scope</dt><dd className="mt-1 text-sm">First-class email body</dd></div>
        </dl>
      </Card>

      {report.warnings?.length ? (
        <Card>
          <h3 className="mb-2 font-semibold">Warnings</h3>
          <ul className="grid gap-1 text-sm">{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </Card>
      ) : null}
    </div>
  );
}
