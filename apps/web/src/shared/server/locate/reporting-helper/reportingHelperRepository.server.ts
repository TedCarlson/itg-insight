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

export async function loadCotpReportingRecord(recordId: string) {
  const admin = supabaseAdmin();

  const { data: record, error: recordError } = await admin
    .from("locate_reporting_record")
    .select("*")
    .eq("locate_reporting_record_id", recordId)
    .eq("report_type", "COTP")
    .single();

  if (recordError) throw new Error(recordError.message);

  const { data: rows, error: rowsError } = await admin
    .from("locate_cotp_report_row")
    .select("*")
    .eq("locate_reporting_record_id", recordId)
    .order("state_code", { ascending: true });

  if (rowsError) throw new Error(rowsError.message);

  return { record, rows: rows ?? [] };
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
