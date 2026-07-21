import type { LocateReportType } from "@/shared/server/locate/reporting-helper/reportingHelperTypes";

export type LocateReportDefinition = {
  reportType: LocateReportType;
  label: string;
  description: string;
  workspaceHref: string;
  historyHref: string;
  progressHref: string | null;
  supportsExport: boolean;
};

export const LOCATE_REPORT_DEFINITIONS: Record<LocateReportType, LocateReportDefinition> = {
  COTP: {
    reportType: "COTP",
    label: "COTP",
    description:
      "Transform operational updates into a leadership-ready report, preserve canonical history, and track performance over time.",
    workspaceHref: "/locate/reporting-helper?reportType=COTP",
    historyHref: "/locate/reporting-helper/history/cotp",
    progressHref: "/locate/reporting-helper/progress/cotp",
    supportsExport: true,
  },
  MASSACHUSETTS_SLA_EXPOSURE: {
    reportType: "MASSACHUSETTS_SLA_EXPOSURE",
    label: "Massachusetts SLA Exposure",
    description:
      "Convert the Massachusetts Ticket Summary into a live COTP penalty-risk view with overdue, near-due, response-evidence, duplicate-ticket, technician, place, division, and region exposure.",
    workspaceHref: "/locate/reporting-helper?reportType=MASSACHUSETTS_SLA_EXPOSURE",
    historyHref: "/locate/reporting-helper/history/massachusetts-sla-exposure",
    progressHref: null,
    supportsExport: false,
  },
  TICKET_RECEIPT_AUDIT: {
    reportType: "TICKET_RECEIPT_AUDIT",
    label: "Ticket Receipt Audit",
    description:
      "Normalize ticket receipt emails into durable operational records with focused history and evidence-backed detail.",
    workspaceHref: "/locate/reporting-helper?reportType=TICKET_RECEIPT_AUDIT",
    historyHref: "/locate/reporting-helper/history/ticket-receipt-audit",
    progressHref: null,
    supportsExport: false,
  },
};

export const LOCATE_REPORT_MODULES = Object.values(LOCATE_REPORT_DEFINITIONS);

export function getLocateReportDefinition(reportType: string | null | undefined) {
  if (!reportType) return null;
  return LOCATE_REPORT_DEFINITIONS[reportType as LocateReportType] ?? null;
}
