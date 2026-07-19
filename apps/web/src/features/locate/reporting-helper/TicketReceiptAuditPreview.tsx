"use client";

import { Card } from "@/components/ui/Card";

type TicketReceiptAuditReport = {
  reportName: "TICKET_RECEIPT_AUDIT";
  family: string;
  ticketNumber: string | null;
  emailReceivedAt: string | null;
  comment: string | null;
  warnings: string[];
  inspection: Record<string, unknown>;
};

export function TicketReceiptAuditPreview({ report }: { report: TicketReceiptAuditReport }) {
  return (
    <div className="grid gap-4">
      <Card>
        <div className="mb-3">
          <h3 className="font-semibold">Normalized Audit Record</h3>
          <p className="text-sm text-[var(--to-ink-muted)]">
            Review the inferred fields before this report unit is connected to historical storage.
          </p>
        </div>

        <dl className="grid gap-3 md:grid-cols-2">
          <div className="rounded border p-3" style={{ borderColor: "var(--to-border)" }}>
            <dt className="text-xs font-medium text-[var(--to-ink-muted)]">Email received</dt>
            <dd className="mt-1 text-sm font-semibold">{report.emailReceivedAt ?? "Not detected"}</dd>
          </div>
          <div className="rounded border p-3" style={{ borderColor: "var(--to-border)" }}>
            <dt className="text-xs font-medium text-[var(--to-ink-muted)]">Family</dt>
            <dd className="mt-1 text-sm font-semibold">{report.family}</dd>
          </div>
          <div className="rounded border p-3" style={{ borderColor: "var(--to-border)" }}>
            <dt className="text-xs font-medium text-[var(--to-ink-muted)]">Ticket</dt>
            <dd className="mt-1 text-sm font-semibold">{report.ticketNumber ?? "Not detected"}</dd>
          </div>
          <div className="rounded border p-3" style={{ borderColor: "var(--to-border)" }}>
            <dt className="text-xs font-medium text-[var(--to-ink-muted)]">Comment</dt>
            <dd className="mt-1 text-sm font-semibold">{report.comment ?? "Not detected"}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">Inspection JSON</h3>
        <pre className="overflow-auto rounded border p-3 text-xs" style={{ borderColor: "var(--to-border)" }}>
          {JSON.stringify(report.inspection, null, 2)}
        </pre>
      </Card>

      {report.warnings.length ? (
        <Card>
          <h3 className="mb-2 font-semibold">Parser Notes</h3>
          <ul className="grid gap-1 text-sm text-[var(--to-ink-muted)]">
            {report.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
