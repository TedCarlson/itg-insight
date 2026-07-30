import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseServer } from "@/shared/data/supabase/server";
import { loadCotpDailyPayload } from "@/shared/server/locate/reporting-helper/cotpDaily.server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const states = new Set((params.get("states") ?? "").split(",").map((value) => value.trim().toUpperCase()).filter(Boolean));
  const reporting = params.get("reporting") ?? "ALL";
  if (!from || !to) return NextResponse.json({ error: "from and to are required" }, { status: 400 });

  try {
    const payload = await loadCotpDailyPayload(from, to);
    const rows = payload.state_rows.filter((row) => {
      if (states.size && !states.has(row.state)) return false;
      if (reporting === "REPORTED_LATEST" && !row.reported_latest_day) return false;
      if (reporting === "MISSING_LATEST" && row.reported_latest_day) return false;
      return true;
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Insight";
    const sheet = workbook.addWorksheet("COTP Day by Day", {
      views: [{ state: "frozen", xSplit: 1, ySplit: 3 }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    sheet.mergeCells(1, 1, 1, Math.max(payload.columns.length + 1, 2));
    sheet.getCell(1, 1).value = `COTP Day by Day · ${from} through ${to}`;
    sheet.getCell(1, 1).font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
    sheet.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    sheet.getRow(1).height = 30;

    const header = sheet.getRow(3);
    header.values = ["State", ...payload.columns.map((column) => column.label)];
    header.font = { bold: true };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

    for (const row of rows) {
      const excelRow = sheet.addRow([row.state, ...payload.columns.map((column) => row.values[column.key] == null ? null : row.values[column.key] / 100)]);
      for (let column = 2; column <= payload.columns.length + 1; column += 1) excelRow.getCell(column).numFmt = "0.0%";
    }

    sheet.getColumn(1).width = 12;
    for (let column = 2; column <= payload.columns.length + 1; column += 1) sheet.getColumn(column).width = 14;
    sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, rows.length + 3), column: payload.columns.length + 1 } };

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer instanceof Buffer ? buffer : Buffer.from(buffer)), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="cotp-day-by-day-${from}-to-${to}.xlsx"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Export failed" }, { status: 500 });
  }
}
