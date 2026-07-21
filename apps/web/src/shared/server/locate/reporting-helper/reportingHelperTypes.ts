export type LocateReportType = "COTP" | "TICKET_RECEIPT_AUDIT" | "MASSACHUSETTS_SLA_EXPOSURE";

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

export type LocateGeneratedReport = CotpGeneratedReport | TicketReceiptAuditGeneratedReport | MassachusettsSlaExposureGeneratedReport;


export type MassachusettsSlaRisk = "OVERDUE" | "DUE_WITHIN_4_HOURS" | "DUE_WITHIN_24_HOURS" | "FUTURE" | "UNKNOWN";

export type MassachusettsSlaExposureRow = {
  ticketId: string; facility: string | null; receivedTime: string; receivedAt: string | null; code: string | null;
  dueTime: string; dueAt: string | null; ticketType: string | null; workType: string | null; excavatorName: string | null;
  state: string | null; place: string | null; status: string | null; lastResponse: string | null; lastResponseDate: string | null;
  lastResponseAt: string | null; totalUnitsOfWork: number | null; assignedTo: string | null; division: string | null; region: string | null;
  risk: MassachusettsSlaRisk; hoursUntilDue: number | null; hasResponseEvidence: boolean; duplicateOccurrenceCount: number;
};

export type MassachusettsSlaExposureGeneratedReport = {
  reportName: "MASSACHUSETTS_SLA_EXPOSURE"; title: string; sourceAsOfLocal: string; sourceAsOfAt: string; reportDate: string;
  rows: MassachusettsSlaExposureRow[];
  summary: { totalRows: number; uniqueTickets: number; overdue: number; dueWithin4Hours: number; dueWithin24Hours: number; future: number; withoutResponseEvidence: number; duplicateTicketIds: number; emergencyTickets: number; renewTickets: number; sourceOverdueTickets?: number; newLateTickets?: number; previouslyReportedLateTickets?: number; };
  exposure: { byTechnician: Array<{label:string;count:number}>; byPlace: Array<{label:string;count:number}>; byDivision: Array<{label:string;count:number}>; byRegion: Array<{label:string;count:number}>; byTicketType: Array<{label:string;count:number}>; };
  duplicateTicketIds: string[]; warnings: string[]; skippedLines: string[];
};
