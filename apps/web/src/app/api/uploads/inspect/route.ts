import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadFamily =
  | "metrics"
  | "check_in"
  | "shift_validation"
  | "unknown";

function parseGeneratedAtFromTitle(title: string | null) {
  if (!title) return null;

  const m = title.match(
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2})/
  );

  if (!m) return null;

  const [mo, da, yr] = m[1].split("/").map(Number);
  const [hh, mi, ss] = m[2].split(":").map(Number);

  const d = new Date(yr, mo - 1, da, hh, mi, ss);

  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function ok(payload: unknown) {
  return NextResponse.json(payload);
}

function hasSummaryAndExport(workbook: XLSX.WorkBook) {
  const names = new Set(
    workbook.SheetNames.map((v) => String(v).trim().toLowerCase())
  );

  return names.has("summary") && names.has("export");
}

function detectCheckIn(workbook: XLSX.WorkBook) {
  const first = workbook.SheetNames?.[0];
  if (!first) return false;

  const ws = workbook.Sheets[first];
  if (!ws) return false;

  const a5 = String(
    (ws["A5"] as any)?.w ??
    (ws["A5"] as any)?.v ??
    ""
  );

  return /Fulfillment\s*Center/i.test(a5);
}

function detectMetrics(workbook: XLSX.WorkBook) {
  const first = workbook.SheetNames?.[0];
  if (!first) return false;

  const ws = workbook.Sheets[first];
  if (!ws) return false;

  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as any[][];

  const title = rows?.[0]?.[0];
  const headerRow = rows?.[1];

  return Boolean(
    title &&
    Array.isArray(headerRow) &&
    headerRow.length > 5
  );
}

function getFirstWorksheetRows(workbook: XLSX.WorkBook) {
  const first = workbook.SheetNames?.[0];
  const ws = first ? workbook.Sheets[first] : null;

  if (!ws) {
    return [] as any[][];
  }

  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as any[][];
}

function countRowsByHeader(rows: any[][], headerNameOptions: string[]) {
  const headers =
    Array.isArray(rows?.[1])
      ? rows[1].map((v: any) =>
          String(v ?? "").trim().toLowerCase()
        )
      : [];

  const wanted = new Set(
    headerNameOptions.map((v) => v.trim().toLowerCase())
  );

  const index = headers.findIndex((h: string) => wanted.has(h));

  if (index < 0) return 0;

  let rowCount = 0;

  for (const row of rows.slice(2)) {
    const value = row?.[index];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim()
    ) {
      rowCount++;
    }
  }

  return rowCount;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing file",
        },
        { status: 400 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    const workbook = XLSX.read(bytes, {
      type: "array",
    });

    const notes: string[] = [];

    if (hasSummaryAndExport(workbook)) {
      notes.push("Summary worksheet detected.");
      notes.push("Export worksheet detected.");

      return ok({
        ok: true,
        family: "shift_validation" satisfies UploadFamily,
        status: "ready",
        fileName: file.name,
        warning_flags: [],
        notes,
      });
    }

    if (detectCheckIn(workbook)) {
      notes.push("Fulfillment Center signature detected.");

      return ok({
        ok: true,
        family: "check_in" satisfies UploadFamily,
        status: "ready",
        fileName: file.name,
        warning_flags: [],
        notes,
      });
    }

    if (detectMetrics(workbook)) {
      const rows = getFirstWorksheetRows(workbook);
      const title = String(rows?.[0]?.[0] ?? "");
      const anchorDate =
        title.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] ?? null;

      const rowCount = countRowsByHeader(rows, ["techid", "tech id"]);

      notes.push("Metrics workbook structure detected.");

      return ok({
        ok: true,
        family: "metrics" satisfies UploadFamily,
        status: "ready",
        fileName: file.name,
        anchor_date: anchorDate,
        fiscal_end_date: anchorDate,
        detected_title: title,
        detected_generated_at: parseGeneratedAtFromTitle(title),
        row_count_total: rowCount,
        warning_flags: [],
        notes,
      });
    }

    notes.push("Unable to determine upload family.");

    return ok({
      ok: true,
      family: "unknown" satisfies UploadFamily,
      status: "error",
      fileName: file.name,
      warning_flags: [],
      notes,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "inspection failed",
      },
      { status: 500 }
    );
  }
}
