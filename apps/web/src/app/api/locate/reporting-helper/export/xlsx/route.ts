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

function deltaValue(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function displayDelta(value: unknown) {
  const num = deltaValue(value);
  if (num == null) return "—";
  return formatChange(num);
}

function timelineLabels(payload: any) {
  const first = payload?.rows?.[0];
  const previous = first?.completedWeekPrevious?.weekEnding ?? "Observation 1";
  const current = first?.completedWeekCurrent?.weekEnding ?? "Observation 2";
  const live = first?.liveWeek?.weekEnding ?? payload?.weekEnding ?? "Observation 3";

  return {
    previous,
    current,
    live,
    completedDelta: `Δ ${previous}→${current}`,
    liveDelta: `Δ ${current}→${live}`,
  };
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recordId = new URL(req.url).searchParams.get("record_id");
  if (!recordId) return NextResponse.json({ error: "record_id is required" }, { status: 400 });

  try {
    const { record } = await loadCotpReportingRecord(recordId);
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

    const labels = timelineLabels(payload);

    const detail = workbook.addWorksheet("State Detail");
    detail.columns = [
      { header: "State", key: "state", width: 12 },
      { header: labels.previous, key: "previous", width: 14 },
      { header: labels.current, key: "current", width: 14 },
      { header: labels.live, key: "live", width: 14 },
      { header: labels.completedDelta, key: "completedDelta", width: 20 },
      { header: labels.liveDelta, key: "liveDelta", width: 20 },
      { header: "Status", key: "status", width: 28 },
    ];

    for (const row of payload?.rows ?? []) {
      detail.addRow({
        state: row.state,
        previous: percentValue(row.completedWeekPrevious?.value),
        current: percentValue(row.completedWeekCurrent?.value),
        live: percentValue(row.liveWeek?.value),
        completedDelta: displayDelta(row.completedWeekDelta),
        liveDelta: displayDelta(row.liveWeekDelta),
        status: row.status,
      });
    }

    detail.views = [{ state: "frozen", ySplit: 1 }];
    detail.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 7 },
    };

    const header = detail.getRow(1);
    header.font = { bold: true, color: { argb: "FF111827" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    header.alignment = { vertical: "middle" };

    detail.getColumn(2).numFmt = "0%";
    detail.getColumn(3).numFmt = "0%";
    detail.getColumn(4).numFmt = "0%";

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

      const status = String(excelRow.getCell(7).value ?? "");
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
