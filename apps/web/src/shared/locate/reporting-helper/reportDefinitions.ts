import type { LocateReportType } from "@/shared/server/locate/reporting-helper/reportingHelperTypes";

export type LocateReportDefinition = {
  reportType: LocateReportType;
  label: string;
  historyHref: string;
  supportsExport: boolean;
};

export const LOCATE_REPORT_DEFINITIONS: Record<LocateReportType, LocateReportDefinition> = {
  COTP: {
    reportType: "COTP",
    label: "COTP",
    historyHref: "/locate/reporting-helper/history/cotp",
    supportsExport: true,
  },
  TICKET_RECEIPT_AUDIT: {
    reportType: "TICKET_RECEIPT_AUDIT",
    label: "Ticket Receipt Audit",
    historyHref: "/locate/reporting-helper/history/ticket-receipt-audit",
    supportsExport: false,
  },
};

export function getLocateReportDefinition(reportType: string | null | undefined) {
  if (!reportType) return null;
  return LOCATE_REPORT_DEFINITIONS[reportType as LocateReportType] ?? null;
}
