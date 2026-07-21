import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseServer } from "@/shared/data/supabase/server";
import { loadLocateReportingRecord } from "@/shared/server/locate/reporting-helper/reportingHelperRepository.server";
import type {
  MassachusettsSlaExposureGeneratedReport,
  MassachusettsSlaExposureRow,
} from "@/shared/server/locate/reporting-helper/reportingHelperTypes";

export const runtime = "nodejs";

const STATUS_STYLE: Record<string, { fill: string; font: string; bold?: boolean }> = {
  "Needs attention": { fill: "FEE2E2", font: "7F1D1D", bold: true },
  "Watch closely": { fill: "FEF9C3", font: "713F12", bold: true },
  "Recovery trending": { fill: "DCFCE7", font: "14532D", bold: true },
  "Improving trend": { fill: "DCFCE7", font: "14532D", bold: true },
  Strong: { fill: "DCFCE7", font: "14532D", bold: true },
  Excellent: { fill: "DCFCE7", font: "14532D", bold: true },
};

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

function styleCells(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
  apply: (cell: ExcelJS.Cell) => void,
) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      apply(sheet.getCell(row, column));
    }
  }
}

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

function safeFilenamePart(value: string | null | undefined) {
  return (value ?? "report").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}

function workbookResponse(workbook: ExcelJS.Workbook, filename: string) {
  return workbook.xlsx.writeBuffer().then((buffer) => {
    const bytes = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  });
}

function styleSectionTitle(sheet: ExcelJS.Worksheet, rowNumber: number, title: string, endColumn: number) {
  sheet.mergeCells(rowNumber, 1, rowNumber, endColumn);
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = title;
  cell.font = { bold: true, color: { argb: "FF1F2937" }, size: 11 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  cell.alignment = { vertical: "middle" };
  sheet.getRow(rowNumber).height = 22;
}

function managementFindings(report: MassachusettsSlaExposureGeneratedReport) {
  const newLate = report.summary.newLateTickets ?? report.summary.overdue;
  const findings: string[] = [
    `${newLate} new-ticket exposure row${newLate === 1 ? " is" : "s are"} represented in this report.`,
  ];
  const topTech = report.exposure.byTechnician[0];
  if (topTech && newLate > 0) {
    findings.push(`${topTech.label} carries the largest technician concentration with ${topTech.count} ticket${topTech.count === 1 ? "" : "s"} (${Math.round((topTech.count / newLate) * 100)}%).`);
  }
  const topPlace = report.exposure.byPlace[0];
  if (topPlace) findings.push(`${topPlace.label} is the highest-exposure municipality with ${topPlace.count} ticket${topPlace.count === 1 ? "" : "s"}.`);
  if (report.summary.withoutResponseEvidence > 0) {
    findings.push(`${report.summary.withoutResponseEvidence} ticket${report.summary.withoutResponseEvidence === 1 ? "" : "s"} have no response evidence in the source.`);
  }
  if ((report.summary.previouslyReportedLateTickets ?? 0) > 0) {
    findings.push(`${report.summary.previouslyReportedLateTickets} previously reported late ticket${report.summary.previouslyReportedLateTickets === 1 ? " was" : "s were"} suppressed from this new-exposure record.`);
  }
  return findings;
}

function addRankingSection(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  items: Array<{ label: string; count: number }>,
) {
  styleSectionTitle(sheet, startRow, title, 4);
  const header = sheet.getRow(startRow + 1);
  header.values = ["Rank", title.replace("Exposure by ", ""), "Tickets", "Share of report"];
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  const total = items.reduce((sum, item) => sum + item.count, 0);
  items.forEach((item, index) => {
    const row = sheet.getRow(startRow + 2 + index);
    row.values = [index + 1, item.label, item.count, total ? item.count / total : 0];
    row.getCell(4).numFmt = "0%";
  });
  const endRow = startRow + Math.max(items.length + 1, 1);
  styleCells(sheet, startRow + 1, endRow, 1, 4, (cell) => {
    cell.border = BORDER;
    cell.alignment = { vertical: "middle" };
  });
  return endRow + 2;
}

function riskDisplay(row: MassachusettsSlaExposureRow) {
  if (row.hoursUntilDue == null) return "Timing unavailable";
  if (row.hoursUntilDue < 0) return `${Math.abs(row.hoursUntilDue).toFixed(1)} hours late`;
  return `${row.hoursUntilDue.toFixed(1)} hours remaining`;
}

function buildMassachusettsWorkbook(record: any, report: MassachusettsSlaExposureGeneratedReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Insight";
  workbook.created = new Date();
  workbook.modified = new Date();

  const intelligence = workbook.addWorksheet("Report Intelligence", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  intelligence.columns = [
    { width: 24 }, { width: 34 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];
  intelligence.views = [{ state: "frozen", ySplit: 5 }];

  intelligence.mergeCells("A1:F1");
  intelligence.getCell("A1").value = "Massachusetts SLA Exposure Report";
  intelligence.getCell("A1").font = { bold: true, size: 20, color: { argb: "FFFFFFFF" } };
  intelligence.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  intelligence.getCell("A1").alignment = { vertical: "middle" };
  intelligence.getRow(1).height = 34;

  intelligence.addRow(["Report date", report.reportDate, "Source as of", report.sourceAsOfLocal, "Generated", new Date()]);
  intelligence.getCell("F2").numFmt = "m/d/yyyy h:mm AM/PM";
  intelligence.addRow(["Record ID", record.locate_reporting_record_id, "Report type", record.report_type, "Rows", report.rows.length]);
  styleCells(intelligence, 2, 3, 1, 6, (cell) => {
    cell.border = BORDER;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  ["A2", "C2", "E2", "A3", "C3", "E3"].forEach((ref) => {
    intelligence.getCell(ref).font = { bold: true, color: { argb: "FF4B5563" } };
    intelligence.getCell(ref).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
  });

  styleSectionTitle(intelligence, 5, "Executive Summary", 6);
  const metrics = [
    ["Source overdue", report.summary.sourceOverdueTickets ?? report.summary.overdue],
    ["New late exposure", report.summary.newLateTickets ?? report.summary.overdue],
    ["Previously reported", report.summary.previouslyReportedLateTickets ?? 0],
    ["No response evidence", report.summary.withoutResponseEvidence],
    ["Technicians exposed", report.exposure.byTechnician.length],
    ["Municipalities exposed", report.exposure.byPlace.length],
  ];
  metrics.forEach(([label, value], index) => {
    const col = index + 1;
    intelligence.getCell(6, col).value = label;
    intelligence.getCell(7, col).value = value;
    intelligence.getCell(6, col).font = { bold: true, size: 9, color: { argb: "FF6B7280" } };
    intelligence.getCell(6, col).alignment = { horizontal: "center", wrapText: true };
    intelligence.getCell(7, col).font = { bold: true, size: 18, color: { argb: col === 2 ? "FF991B1B" : "FF111827" } };
    intelligence.getCell(7, col).alignment = { horizontal: "center" };
    intelligence.getCell(6, col).border = BORDER;
    intelligence.getCell(7, col).border = BORDER;
  });
  intelligence.getRow(7).height = 30;

  styleSectionTitle(intelligence, 9, "Management Findings", 6);
  const findings = managementFindings(report);
  findings.forEach((finding, index) => {
    const rowNumber = 10 + index;
    intelligence.mergeCells(rowNumber, 1, rowNumber, 6);
    intelligence.getCell(rowNumber, 1).value = `• ${finding}`;
    intelligence.getCell(rowNumber, 1).alignment = { vertical: "middle", wrapText: true };
    intelligence.getCell(rowNumber, 1).border = BORDER;
    intelligence.getRow(rowNumber).height = 24;
  });

  let cursor = 11 + findings.length;
  cursor = addRankingSection(intelligence, cursor, "Exposure by Technician", report.exposure.byTechnician);
  cursor = addRankingSection(intelligence, cursor, "Exposure by Municipality", report.exposure.byPlace);
  cursor = addRankingSection(intelligence, cursor, "Exposure by Division", report.exposure.byDivision);
  addRankingSection(intelligence, cursor, "Exposure by Ticket Type", report.exposure.byTicketType);

  const evidence = workbook.addWorksheet("Ticket Evidence", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  evidence.columns = [
    { key: "ticket", width: 18 },
    { key: "exposure", width: 20 },
    { key: "due", width: 22 },
    { key: "assigned", width: 24 },
    { key: "place", width: 22 },
    { key: "type", width: 14 },
    { key: "response", width: 24 },
    { key: "division", width: 22 },
    { key: "region", width: 22 },
    { key: "facility", width: 14 },
    { key: "duplicates", width: 12 },
  ];
  evidence.views = [{ state: "frozen", ySplit: 4 }];

  evidence.mergeCells("A1:K1");
  evidence.getCell("A1").value = "New-Ticket Evidence";
  evidence.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  evidence.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  evidence.getRow(1).height = 32;
  evidence.mergeCells("A2:K2");
  evidence.getCell("A2").value = "Ticket number is the row-grain identity. Rows are grouped by assigned technician for operational follow-up.";
  evidence.getCell("A2").font = { italic: true, color: { argb: "FF4B5563" } };

  const grouped = new Map<string, MassachusettsSlaExposureRow[]>();
  for (const row of report.rows) {
    const group = row.assignedTo?.trim() || "Unassigned";
    grouped.set(group, [...(grouped.get(group) ?? []), row]);
  }
  const groups = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  let rowCursor = 4;
  for (const [technician, rows] of groups) {
    evidence.mergeCells(rowCursor, 1, rowCursor, 11);
    const groupCell = evidence.getCell(rowCursor, 1);
    groupCell.value = `${technician} — ${rows.length} ticket${rows.length === 1 ? "" : "s"}`;
    groupCell.font = { bold: true, color: { argb: "FF1F2937" } };
    groupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    evidence.getRow(rowCursor).height = 23;
    rowCursor += 1;

    const header = evidence.getRow(rowCursor);
    header.values = ["Ticket Number", "Exposure", "Due", "Assigned", "Municipality", "Type", "Response Evidence", "Division", "Region", "Facility", "Source Occurrences"];
    header.font = { bold: true, color: { argb: "FF111827" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    header.alignment = { vertical: "middle", wrapText: true };
    rowCursor += 1;

    for (const sourceRow of rows) {
      const excelRow = evidence.getRow(rowCursor);
      excelRow.values = [
        sourceRow.ticketId,
        riskDisplay(sourceRow),
        sourceRow.dueTime,
        sourceRow.assignedTo ?? "—",
        sourceRow.place ?? "—",
        sourceRow.ticketType ?? sourceRow.workType ?? "—",
        sourceRow.hasResponseEvidence ? `${sourceRow.lastResponse ?? "Response"} ${sourceRow.lastResponseDate ?? ""}`.trim() : "None",
        sourceRow.division ?? "—",
        sourceRow.region ?? "—",
        sourceRow.facility ?? "—",
        sourceRow.duplicateOccurrenceCount,
      ];
      excelRow.getCell(1).font = { bold: true, name: "Courier New" };
      excelRow.getCell(2).font = { color: { argb: sourceRow.risk === "OVERDUE" ? "FF991B1B" : "FF92400E" }, bold: true };
      excelRow.alignment = { vertical: "middle", wrapText: false };
      rowCursor += 1;
    }

    const subtotal = evidence.getRow(rowCursor);
    subtotal.values = ["Group total", rows.length];
    subtotal.font = { bold: true };
    subtotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
    rowCursor += 2;
  }

  styleCells(evidence, 4, Math.max(rowCursor - 1, 4), 1, 11, (cell) => {
    cell.border = BORDER;
    cell.alignment = { ...cell.alignment, vertical: "middle" };
  });
  if (!groups.length) {
    evidence.getRow(4).values = ["Ticket Number", "Exposure", "Due", "Assigned", "Municipality", "Type", "Response Evidence", "Division", "Region", "Facility", "Source Occurrences"];
    evidence.getRow(4).font = { bold: true };
    evidence.autoFilter = { from: "A4", to: "K4" };
  }

  intelligence.headerFooter.oddFooter = "Insight · Massachusetts SLA Exposure · Page &P of &N";
  evidence.headerFooter.oddFooter = "Insight · Ticket Evidence · Page &P of &N";

  return workbook;
}

function buildCotpWorkbook(record: any, payload: any) {
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
  detail.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };
  const header = detail.getRow(1);
  header.font = { bold: true, color: { argb: "FF111827" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  header.alignment = { vertical: "middle" };
  detail.getColumn(2).numFmt = "0%";
  detail.getColumn(3).numFmt = "0%";
  detail.getColumn(4).numFmt = "0%";

  detail.eachRow((excelRow, rowNumber) => {
    excelRow.eachCell((cell) => {
      cell.border = BORDER;
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

  return workbook;
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recordId = new URL(req.url).searchParams.get("record_id");
  if (!recordId) return NextResponse.json({ error: "record_id is required" }, { status: 400 });

  try {
    const { record } = await loadLocateReportingRecord(recordId);
    const payload = record.parsed_payload as any;

    if (record.report_type === "MASSACHUSETTS_SLA_EXPOSURE" && payload?.reportName === "MASSACHUSETTS_SLA_EXPOSURE") {
      const workbook = buildMassachusettsWorkbook(record, payload as MassachusettsSlaExposureGeneratedReport);
      return await workbookResponse(workbook, `massachusetts-sla-exposure-${safeFilenamePart(payload.reportDate)}.xlsx`);
    }

    if (record.report_type === "COTP") {
      const workbook = buildCotpWorkbook(record, payload);
      return await workbookResponse(workbook, `cotp-report-${safeFilenamePart(record.week_ending_date ?? recordId)}.xlsx`);
    }

    return NextResponse.json({ error: "Excel export is not available for this report type." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Export failed" }, { status: 500 });
  }
}
