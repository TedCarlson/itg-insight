import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type { LocateReportType } from "@/shared/server/locate/reporting-helper/reportingHelperTypes";

export const runtime = "nodejs";
const SUPPORTED_REPORT_TYPES = new Set<LocateReportType>(["COTP", "TICKET_RECEIPT_AUDIT", "MASSACHUSETTS_SLA_EXPOSURE"]);
function num(v: string | null, fallback: number) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const reportType = (url.searchParams.get("report_type") ?? "COTP").trim().toUpperCase() as LocateReportType;
  if (!SUPPORTED_REPORT_TYPES.has(reportType)) return NextResponse.json({ error: "Unsupported report type." }, { status: 400 });

  const pageIndex = Math.max(0, num(url.searchParams.get("pageIndex"), 0));
  const pageSize = Math.min(100, Math.max(5, num(url.searchParams.get("pageSize"), 25)));
  const from = pageIndex * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin().from("locate_reporting_record").select(
    "locate_reporting_record_id,report_type,report_date,week_ending_date,inferred_year,source_as_of_at,parsed_payload,summary_payload,created_by_auth_user_id,created_at,updated_at",
    { count: "exact" }
  ).eq("report_type", reportType);

  query = reportType === "COTP"
    ? query.order("week_ending_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })
    : query.order("source_as_of_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((record: any) => {
    const parsed = record.parsed_payload ?? {};
    if (reportType === "TICKET_RECEIPT_AUDIT") {
      return {
        record_id: record.locate_reporting_record_id,
        report_type: record.report_type,
        report_date: record.report_date,
        email_received_at: parsed.emailReceivedAt ?? record.summary_payload?.email_received_at ?? null,
        family: parsed.family ?? record.summary_payload?.family ?? null,
        ticket_number: parsed.ticketNumber ?? record.summary_payload?.ticket_number ?? null,
        comment: parsed.comment ?? record.summary_payload?.comment ?? null,
        source_as_of_at: record.source_as_of_at,
        created_at: record.created_at,
      };
    }

    if (reportType === "MASSACHUSETTS_SLA_EXPOSURE") {
      return {
        record_id: record.locate_reporting_record_id,
        report_type: record.report_type,
        report_date: record.report_date,
        source_as_of_at: record.source_as_of_at,
        total_rows: parsed.summary?.totalRows ?? 0,
        unique_tickets: parsed.summary?.uniqueTickets ?? 0,
        overdue: parsed.summary?.overdue ?? 0,
        due_within_4_hours: parsed.summary?.dueWithin4Hours ?? 0,
        without_response_evidence: parsed.summary?.withoutResponseEvidence ?? 0,
        duplicate_ticket_ids: parsed.summary?.duplicateTicketIds ?? 0,
        created_at: record.created_at,
      };
    }

    return {
      record_id: record.locate_reporting_record_id,
      report_type: record.report_type,
      report_date: record.report_date,
      week_ending_date: record.week_ending_date,
      week_ending_label: parsed.weekEnding ?? null,
      overall_performance: parsed.overallPerformance ?? null,
      state_count: Array.isArray(parsed.rows) ? parsed.rows.length : 0,
      needs_attention_count: Array.isArray(parsed.rows) ? parsed.rows.filter((r: any) => String(r.status).toLowerCase() === "needs attention").length : 0,
      watch_closely_count: Array.isArray(parsed.rows) ? parsed.rows.filter((r: any) => String(r.status).toLowerCase() === "watch closely").length : 0,
      created_by_auth_user_id: record.created_by_auth_user_id,
      source_as_of_at: record.source_as_of_at,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  });

  return NextResponse.json({ rows, page: { pageIndex, pageSize, totalRows: count ?? 0 } });
}
