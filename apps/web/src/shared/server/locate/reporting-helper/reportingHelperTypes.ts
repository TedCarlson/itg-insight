export type LocateReportType = "COTP" | "TICKET_RECEIPT_AUDIT";

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


export type TicketReceiptAuditGeneratedReport = {
  reportName: "TICKET_RECEIPT_AUDIT";
  family: string;
  ticketNumber: string | null;
  emailReceivedAt: string | null;
  comment: string | null;
  sourceScope: "FIRST_CLASS_EMAIL_BODY";
  warnings: string[];
  inspection: {
    email_received_at: string | null;
    family: string;
    ticket_number: string | null;
    comment: string | null;
  };
};

export type LocateGeneratedReport = CotpGeneratedReport | TicketReceiptAuditGeneratedReport;
