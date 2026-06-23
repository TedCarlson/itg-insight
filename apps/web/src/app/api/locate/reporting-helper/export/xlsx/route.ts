import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseServer } from "@/shared/data/supabase/server";
import { loadCotpReportingRecord } from "@/shared/server/locate/reporting-helper/reportingHelperRepository.server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recordId = new URL(req.url).searchParams.get("record_id");
  if (!recordId) return NextResponse.json({ error: "record_id is required" }, { status: 400 });

  try {
    const { record, rows } = await loadCotpReportingRecord(recordId);
    const payload = record.parsed_payload as any;

    const detailRows = rows.map((row: any) => ({
      State: row.state_code,
      "Week Ending": Number(row.week_ending_value),
      "Prior Week": Number(row.prior_week_value),
      Change: Number(row.change_points),
      "Current Week Trend": row.current_week_trend == null ? "" : Number(row.current_week_trend),
      Status: row.status,
    }));

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Field: "Report Type", Value: record.report_type },
        { Field: "Week Ending", Value: record.week_ending_date },
        { Field: "Overall Performance", Value: payload?.overallPerformance ?? "" },
        { Field: "Executive Summary", Value: payload?.executiveSummary ?? "" },
      ]),
      "Summary"
    );

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "State Detail");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const filename = `cotp-report-${record.week_ending_date ?? recordId}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Export failed" }, { status: 500 });
  }
}
