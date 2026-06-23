import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseServer } from "@/shared/data/supabase/server";
import { loadCotpReportingRecord } from "@/shared/server/locate/reporting-helper/reportingHelperRepository.server";

export const runtime = "nodejs";

const STATUS_STYLE: Record<string, { fill: string; font: string; bold?: boolean }> = {
  "Needs attention": { fill: "FEE2E2", font: "7F1D1D", bold: true },
  "Watch closely": { fill: "FEF9C3", font: "713F12", bold: true },
  "Recovery trending": { fill: "DCFCE7", font: "14532D", bold: true },
  "Improving trend": { fill: "DCFCE7", font: "14532D", bold: true },
  "Strong": { fill: "DCFCE7", font: "14532D", bold: true },
  "Excellent": { fill: "DCFCE7", font: "14532D", bold: true },
};

function formatChange(points: number) {
  if (points > 0) return `▲ +${points} ${points === 1 ? "pt" : "pts"}`;
  if (points < 0) return `▼ ${points} pts`;
  return "— 0 pts";
}

function percentValue(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num / 100 : null;
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recordId = new URL(req.url).searchParams.get("record_id");
  if (!recordId) return NextResponse.json({ error: "record_id is required" }, { status: 400 });

  try {
    const { record, rows } = await loadCotpReportingRecord(recordId);
    const payload = record.parsed_payload as any;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Insight";
    workbook.created = new Date();

    const summary = workbook.addWorksheet("Summary");
    summary.columns = [
      { header: "Field", key: "field", width: 26 },
      { header: "Value", key: "value", width: 90 },
    ];

    summary.addRows([
      { field: "Report Type", value: record.report_type },
      { field: "Week Ending", value: record.week_ending_date },
      { field: "Overall Performance", value: payload?.overallPerformance == null ? "" : `${payload.overallPerformance}%` },
      { field: "Executive Summary", value: payload?.executiveSummary ?? "" },
    ]);

    summary.getRow(1).font = { bold: true };
    summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    summary.getColumn(2).alignment = { wrapText: true, vertical: "top" };

    const detail = workbook.addWorksheet("State Detail");
    detail.columns = [
      { header: "State", key: "state", width: 12 },
      { header: `Week Ending ${record.week_ending_date ?? ""}`, key: "weekEnding", width: 20 },
      { header: "Prior Week", key: "priorWeek", width: 16 },
      { header: "Change", key: "change", width: 16 },
      { header: "Current Trend %", key: "trend", width: 18 },
      { header: "Performance Status", key: "status", width: 28 },
    ];

    for (const row of rows as any[]) {
      const changePoints = Number(row.change_points);
      detail.addRow({
        state: row.state_code,
        weekEnding: percentValue(row.week_ending_value),
        priorWeek: percentValue(row.prior_week_value),
        change: formatChange(Number.isFinite(changePoints) ? changePoints : 0),
        trend: row.current_week_trend == null ? null : percentValue(row.current_week_trend),
        status: row.status,
      });
    }

    detail.views = [{ state: "frozen", ySplit: 1 }];
    detail.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 6 },
    };

    const header = detail.getRow(1);
    header.font = { bold: true, color: { argb: "FF111827" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    header.alignment = { vertical: "middle" };

    detail.getColumn(2).numFmt = "0%";
    detail.getColumn(3).numFmt = "0%";
    detail.getColumn(5).numFmt = "0%";

    detail.eachRow((excelRow, rowNumber) => {
      excelRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
        cell.alignment = { vertical: "middle" };
      });

      if (rowNumber === 1) return;

      const status = String(excelRow.getCell(6).value ?? "");
      const style = STATUS_STYLE[status];
      if (!style) return;

      excelRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${style.fill}` } };
        cell.font = { color: { argb: `FF${style.font}` }, bold: style.bold ?? false };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
    const filename = `cotp-report-${record.week_ending_date ?? recordId}.xlsx`;

    return new NextResponse(new Uint8Array(bytes), {
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
