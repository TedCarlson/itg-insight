import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type { TicketReceiptAuditGeneratedReport } from "./reportingHelperTypes";
import type { CotpGeneratedReport } from "./reportingHelperTypes";

export async function saveCotpReportingRecord(args: {
  report: CotpGeneratedReport;
  sourceText: string;
  createdByAuthUserId: string | null;
}) {
  const admin = supabaseAdmin();

  const { data: record, error: recordError } = await admin
    .from("locate_reporting_record")
    .insert({
      report_type: "COTP",
      report_date: args.report.weekEndingDate,
      week_ending_date: args.report.weekEndingDate,
      inferred_year: args.report.inferredYear,
      source_text: args.sourceText,
      parsed_payload: args.report,
      summary_payload: {
        executiveSummary: args.report.executiveSummary,
        keyTakeaways: args.report.keyTakeaways,
        emailDraft: args.report.emailDraft,
      },
      created_by_auth_user_id: args.createdByAuthUserId,
    })
    .select("locate_reporting_record_id")
    .single();

  if (recordError) throw new Error(recordError.message);

  const recordId = record.locate_reporting_record_id as string;

  const rows = args.report.rows.map((row) => ({
    locate_reporting_record_id: recordId,
    state_code: row.state,
    week_ending_value: row.completedWeekCurrent.value,
    prior_week_value: row.completedWeekPrevious.value,
    current_week_trend: row.liveWeek.value,
    change_points: row.liveWeekDelta ?? row.completedWeekDelta,
    status: row.status,
    prior_week_range: row.completedWeekPrevious.weekEnding,
  }));

  const { error: rowError } = await admin.from("locate_cotp_report_row").insert(rows);
  if (rowError) throw new Error(rowError.message);

  const observationRows = args.report.rows
    .filter((row) => row.liveWeek.value != null && args.report.weekEndingDate)
    .map((row) => ({
      metric_key: "COTP",
      state_code: row.state,
      observation_date: args.report.weekEndingDate,
      observation_status: "IN_PROGRESS",
      numeric_value: row.liveWeek.value,
      source_record_id: recordId,
      source_family: "COTP_HELPER",
      source_as_of_at: new Date().toISOString(),
      raw_context: {
        report_type: "COTP",
        week_ending_date: args.report.weekEndingDate,
        source_row: row,
      },
    }));

  if (observationRows.length) {
    const { error: observationError } = await admin
      .from("locate_metric_observation")
      .upsert(observationRows, {
        onConflict: "metric_key,state_code,observation_date,observation_status",
      });

    if (observationError) throw new Error(observationError.message);
  }

  return { recordId };
}

export async function loadLocateReportingRecord(recordId: string) {
  const admin = supabaseAdmin();

  const { data: record, error: recordError } = await admin
    .from("locate_reporting_record")
    .select("*")
    .eq("locate_reporting_record_id", recordId)
    .single();

  if (recordError) throw new Error(recordError.message);

  if (record.report_type !== "COTP") {
    return { record, rows: [] };
  }

  const { data: rows, error: rowsError } = await admin
    .from("locate_cotp_report_row")
    .select("*")
    .eq("locate_reporting_record_id", recordId)
    .order("state_code", { ascending: true });

  if (rowsError) throw new Error(rowsError.message);

  return { record, rows: rows ?? [] };
}

export async function loadCotpReportingRecord(recordId: string) {
  const result = await loadLocateReportingRecord(recordId);

  if (result.record.report_type !== "COTP") {
    throw new Error("Requested reporting record is not a COTP report.");
  }

  return result;
}

function normalizeTicketReceiptTimestamp(value: string | null) {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function saveTicketReceiptAuditReportingRecord(args: {
  report: TicketReceiptAuditGeneratedReport;
  sourceText: string;
  createdByAuthUserId: string | null;
}) {
  const admin = supabaseAdmin();
  const sourceAsOfAt = normalizeTicketReceiptTimestamp(
    args.report.emailReceivedAt
  );
  const reportDate = sourceAsOfAt?.slice(0, 10) ?? null;

  const { data: record, error } = await admin
    .from("locate_reporting_record")
    .insert({
      report_type: "TICKET_RECEIPT_AUDIT",
      report_date: reportDate,
      week_ending_date: null,
      inferred_year: reportDate
        ? Number(reportDate.slice(0, 4))
        : null,
      source_as_of_at: sourceAsOfAt,
      source_text: args.sourceText,
      parsed_payload: args.report,
      summary_payload: args.report.inspection,
      created_by_auth_user_id: args.createdByAuthUserId,
    })
    .select("locate_reporting_record_id")
    .single();

  if (error) throw new Error(error.message);

  return {
    recordId: record.locate_reporting_record_id as string,
  };
}

export async function saveMassachusettsSlaExposureReportingRecord(args: {
  report: import("./reportingHelperTypes").MassachusettsSlaExposureGeneratedReport;
  sourceText: string;
  createdByAuthUserId: string | null;
}) {
  const admin = supabaseAdmin();

  // A source export may repeat the same ticket more than once. Keep only the
  // latest source occurrence before checking the permanent first-late ledger.
  const overdueByTicket = new Map<string, (typeof args.report.rows)[number]>();
  for (const row of args.report.rows) {
    if (row.risk === "OVERDUE") overdueByTicket.set(row.ticketId, row);
  }
  const sourceOverdueRows = [...overdueByTicket.values()];

  const { data: record, error: recordError } = await admin
    .from("locate_reporting_record")
    .insert({
      report_type: "MASSACHUSETTS_SLA_EXPOSURE",
      report_date: args.report.reportDate,
      week_ending_date: null,
      inferred_year: Number(args.report.reportDate.slice(0, 4)),
      source_as_of_at: args.report.sourceAsOfAt,
      source_text: args.sourceText,
      parsed_payload: args.report,
      summary_payload: args.report.summary,
      created_by_auth_user_id: args.createdByAuthUserId,
    })
    .select("locate_reporting_record_id")
    .single();

  if (recordError) throw new Error(recordError.message);
  const recordId = record.locate_reporting_record_id as string;

  const ledgerCandidates = sourceOverdueRows.map((row) => ({
    ticket_id: row.ticketId,
    first_reported_record_id: recordId,
    first_source_as_of_at: args.report.sourceAsOfAt,
    first_due_at_local: row.dueAt,
    first_assigned_to: row.assignedTo,
    first_place_name: row.place,
    first_division_name: row.division,
    first_region_name: row.region,
    first_payload: row,
  }));

  let claimedTicketIds = new Set<string>();
  if (ledgerCandidates.length) {
    const { data: claimed, error: ledgerError } = await admin
      .from("locate_massachusetts_sla_late_ticket")
      .upsert(ledgerCandidates, { onConflict: "ticket_id", ignoreDuplicates: true })
      .select("ticket_id");
    if (ledgerError) throw new Error(ledgerError.message);
    claimedTicketIds = new Set((claimed ?? []).map((row) => String(row.ticket_id)));
  }

  const newLateRows = sourceOverdueRows.filter((row) => claimedTicketIds.has(row.ticketId));
  const countBy = (key: (row: (typeof newLateRows)[number]) => string | null) => {
    const counts = new Map<string, number>();
    for (const row of newLateRows) {
      const label = key(row)?.trim() || "Unspecified";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  };

  const savedReport = {
    ...args.report,
    title: "Massachusetts New Late Tickets",
    rows: newLateRows,
    summary: {
      ...args.report.summary,
      totalRows: newLateRows.length,
      uniqueTickets: newLateRows.length,
      overdue: newLateRows.length,
      dueWithin4Hours: 0,
      dueWithin24Hours: 0,
      future: 0,
      withoutResponseEvidence: newLateRows.filter((row) => !row.hasResponseEvidence).length,
      duplicateTicketIds: args.report.duplicateTicketIds.length,
      emergencyTickets: newLateRows.filter((row) => row.ticketType?.toUpperCase() === "EMERGENCY").length,
      renewTickets: newLateRows.filter((row) => row.ticketType?.toUpperCase() === "RENEW").length,
      sourceOverdueTickets: sourceOverdueRows.length,
      newLateTickets: newLateRows.length,
      previouslyReportedLateTickets: sourceOverdueRows.length - newLateRows.length,
    },
    exposure: {
      byTechnician: countBy((row) => row.assignedTo),
      byPlace: countBy((row) => row.place),
      byDivision: countBy((row) => row.division),
      byRegion: countBy((row) => row.region),
      byTicketType: countBy((row) => row.ticketType),
    },
    warnings: [
      ...args.report.warnings,
      `${sourceOverdueRows.length - newLateRows.length} previously reported late ticket(s) were suppressed.`,
    ],
  } satisfies import("./reportingHelperTypes").MassachusettsSlaExposureGeneratedReport;

  const { error: updateError } = await admin
    .from("locate_reporting_record")
    .update({ parsed_payload: savedReport, summary_payload: savedReport.summary })
    .eq("locate_reporting_record_id", recordId);
  if (updateError) throw new Error(updateError.message);

  if (newLateRows.length) {
    const rows = newLateRows.map((row) => ({
      locate_reporting_record_id: recordId,
      ticket_id: row.ticketId,
      received_at_local: row.receivedAt,
      due_at_local: row.dueAt,
      ticket_type: row.ticketType,
      work_type: row.workType,
      excavator_name: row.excavatorName,
      state_code: row.state,
      place_name: row.place,
      ticket_status: row.status,
      last_response: row.lastResponse,
      last_response_at_local: row.lastResponseAt,
      assigned_to: row.assignedTo,
      division_name: row.division,
      region_name: row.region,
      risk_status: row.risk,
      hours_until_due: row.hoursUntilDue,
      has_response_evidence: row.hasResponseEvidence,
      duplicate_occurrence_count: row.duplicateOccurrenceCount,
      raw_payload: row,
    }));
    const { error: rowError } = await admin.from("locate_massachusetts_sla_exposure_row").insert(rows);
    if (rowError) throw new Error(rowError.message);
  }

  return { recordId, report: savedReport };
}
