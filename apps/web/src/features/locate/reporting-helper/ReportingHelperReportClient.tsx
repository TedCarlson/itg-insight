"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CotpReportDetail } from "./CotpReportDetail";
import { TicketReceiptAuditReportClient } from "./TicketReceiptAuditReportClient";
import type { LocateGeneratedReport } from "@/shared/server/locate/reporting-helper/reportingHelperTypes";

export function ReportingHelperReportClient({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [report, setReport] = useState<LocateGeneratedReport | null>(null);
  const [record, setRecord] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/locate/reporting-helper/reports/${encodeURIComponent(recordId)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load report");
        if (!cancelled) {
          setRecord(json.record ?? null);
          setReport(json.report ?? null);
        }
      } catch (error: any) {
        if (!cancelled) setErr(error?.message ?? "Failed to load report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [recordId]);

  async function removeRecord() {
    const label = record?.report_type === "TICKET_RECEIPT_AUDIT" ? "Ticket Receipt Audit" : "COTP";
    if (!window.confirm(`Delete this saved ${label} report?`)) return;
    const res = await fetch(`/api/locate/reporting-helper/reports/${encodeURIComponent(recordId)}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(json.error ?? "Delete failed");
      return;
    }
    router.push(record?.report_type === "TICKET_RECEIPT_AUDIT" ? "/locate/reporting-helper/history/ticket-receipt-audit" : "/locate/reporting-helper/history/cotp");
  }

  if (loading) return <Card><div className="text-sm text-[var(--to-ink-muted)]">Loading saved report…</div></Card>;
  if (err || !report || !record) return <Card><div className="text-sm text-[var(--to-danger)]">{err ?? "Report not found"}</div></Card>;

  if (record.report_type === "TICKET_RECEIPT_AUDIT" && report.reportName === "TICKET_RECEIPT_AUDIT") {
    return <TicketReceiptAuditReportClient recordId={recordId} record={record} report={report} onDelete={() => void removeRecord()} />;
  }

  if (record.report_type === "COTP" && report.reportName === "COTP") {
    return <CotpReportDetail recordId={recordId} record={record} report={report} onDelete={() => void removeRecord()} />;
  }

  return <Card><div className="text-sm text-[var(--to-danger)]">Unsupported saved report type.</div></Card>;
}
