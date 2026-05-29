import { supabaseAdmin } from "@/shared/data/supabase/admin";
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
    week_ending_value: row.weekEndingValue,
    prior_week_value: row.priorWeekValue,
    current_week_trend: row.currentWeekTrend,
    change_points: row.changePoints,
    status: row.status,
    prior_week_range: row.priorWeekRange,
  }));

  const { error: rowError } = await admin.from("locate_cotp_report_row").insert(rows);
  if (rowError) throw new Error(rowError.message);

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
