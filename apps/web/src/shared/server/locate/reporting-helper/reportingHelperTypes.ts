export type LocateReportType = "COTP";

export type CotpStatus =
  | "Excellent"
  | "Recovery trending"
  | "Strong improvement"
  | "Needs attention"
  | "Strong"
  | "Watch closely"
  | "Improving trend"
  | "Stable";

export type CotpParsedRow = {
  state: string;
  weekEndingValue: number;
  direction: string;
  priorWeekValue: number;
  priorWeekRange: string | null;
  currentWeekTrend: number | null;
  changePoints: number;
  changeDisplay: string;
  status: CotpStatus;
};

export type CotpGeneratedReport = {
  reportName: "COTP";
  weekEnding: string | null;
  weekEndingDate: string | null;
  inferredYear: number | null;
  overallPerformance: number | null;
  contextNote: string | null;
  rows: CotpParsedRow[];
  executiveSummary: string;
  keyTakeaways: Record<string, string[]>;
  emailDraft: {
    subject: string;
    body: string;
  };
  warnings: string[];
  skippedLines: string[];
};
