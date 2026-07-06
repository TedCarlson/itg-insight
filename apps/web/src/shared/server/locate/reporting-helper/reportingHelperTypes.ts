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

  completedWeekPrevious: {
    weekEnding: string | null;
    value: number;
  };

  completedWeekCurrent: {
    weekEnding: string | null;
    value: number;
  };

  liveWeek: {
    weekEnding: string | null;
    value: number | null;
  };

  direction: string;

  completedWeekDelta: number;
  liveWeekDelta: number | null;

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
