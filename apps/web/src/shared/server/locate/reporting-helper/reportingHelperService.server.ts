import { generateCotpReport } from "./cotpParser.server";
import { saveCotpReportingRecord } from "./reportingHelperRepository.server";

export function generateLocateReport(args: { reportType: string; rawText: string }) {
  const reportType = String(args.reportType ?? "").toUpperCase();

  if (reportType !== "COTP") {
    throw new Error("Unsupported report type.");
  }

  return generateCotpReport(args.rawText);
}

export async function saveLocateReport(args: {
  reportType: string;
  rawText: string;
  createdByAuthUserId: string | null;
}) {
  const report = generateLocateReport({
    reportType: args.reportType,
    rawText: args.rawText,
  });

  const saved = await saveCotpReportingRecord({
    report,
    sourceText: args.rawText,
    createdByAuthUserId: args.createdByAuthUserId,
  });

  return { ...saved, report };
}
