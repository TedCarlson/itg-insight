import { generateMassachusettsSlaExposureReport } from "./massachusettsSlaExposureParser.server";
import { generateCotpReport } from "./cotpParser.server";
import { saveTicketReceiptAuditReportingRecord, saveMassachusettsSlaExposureReportingRecord } from "./reportingHelperRepository.server";
import { saveCotpReportingRecord } from "./reportingHelperRepository.server";
import { generateTicketReceiptAuditReport } from "./ticketReceiptAuditParser.server";

export function generateLocateReport(args: { reportType: string; rawText: string }) {
  const reportType = String(args.reportType ?? "").toUpperCase();

  if (reportType === "COTP") return generateCotpReport(args.rawText);
  if (reportType === "TICKET_RECEIPT_AUDIT") return generateTicketReceiptAuditReport(args.rawText);
  if (reportType === "MASSACHUSETTS_SLA_EXPOSURE") return generateMassachusettsSlaExposureReport(args.rawText);

  throw new Error("Unsupported report type.");
}

export async function saveLocateReport(args: {
  reportType: string;
  rawText: string;
  createdByAuthUserId: string | null;
}) {
  const reportType = String(args.reportType ?? "").toUpperCase();

  if (reportType === "COTP") {
    const report = generateCotpReport(args.rawText);
    const saved = await saveCotpReportingRecord({
      report,
      sourceText: args.rawText,
      createdByAuthUserId: args.createdByAuthUserId,
    });

    return { ...saved, report };
  }

  if (reportType === "TICKET_RECEIPT_AUDIT") {
    const report = generateTicketReceiptAuditReport(args.rawText);
    const saved = await saveTicketReceiptAuditReportingRecord({
      report,
      sourceText: args.rawText,
      createdByAuthUserId: args.createdByAuthUserId,
    });

    return { ...saved, report };
  }

  if (reportType === "MASSACHUSETTS_SLA_EXPOSURE") {
    const report = generateMassachusettsSlaExposureReport(args.rawText);
    const saved = await saveMassachusettsSlaExposureReportingRecord({
      report,
      sourceText: args.rawText,
      createdByAuthUserId: args.createdByAuthUserId,
    });
    return saved;
  }

  throw new Error("Unsupported report type.");
}
