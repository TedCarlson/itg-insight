import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireAccessPass } from "@/shared/access/requireAccessPass";

export const runtime = "nodejs";

type ReportRow = {
  report_id: string;
  job_number: string | null;
  job_type: string | null;
  status: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  subject_full_name: string | null;
  subject_tech_id: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy_m: number | null;
  location_captured_at: string | null;
};

type AttachmentRow = {
  report_id: string;
  photo_label_key: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  deleted_at: string | null;
};

const EVIDENCE = [
  { key: "tap_photo", label: "Tap Photo" },
  { key: "ground_block_photo", label: "Ground Block Photo" },
  { key: "bond_point_photo", label: "Bond Point Photo" },
  { key: "workorder_snapshot", label: "Workorder Snapshot" },
] as const;

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US");
}

function fmtTimestamp(value: Date) {
  return value.toLocaleString("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function storageObjectPath(filePath: string | null | undefined) {
  if (!filePath) return null;
  return filePath.startsWith("field-log/") ? filePath.slice("field-log/".length) : filePath;
}

function sanitizeFilePart(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function gpsAccuracyDisplay(value: number | null | undefined) {
  if (value == null) return "";
  if (value > 500) return "";
  return Math.round(value);
}

function gpsQuality(value: number | null | undefined) {
  if (value == null) return "NO GPS";
  if (value <= 100) return "GOOD";
  if (value <= 500) return "LOW ACCURACY";
  return "LOW ACCURACY";
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = rgb(0.08, 0.1, 0.18),
) {
  page.drawText(text, { x, y, size, font, color });
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function downloadAttachmentBytes(
  supabase: ReturnType<typeof supabaseAdmin>,
  attachment: AttachmentRow | undefined,
) {
  const objectPath = storageObjectPath(attachment?.file_path);
  if (!objectPath) return null;

  const { data, error } = await supabase.storage.from("field-log").download(objectPath);
  if (error || !data) return null;

  return {
    bytes: new Uint8Array(await data.arrayBuffer()),
    mimeType: attachment?.mime_type ?? "",
  };
}

async function drawImageBox(args: {
  pdf: PDFDocument;
  page: PDFPage;
  bytes: Uint8Array | null;
  mimeType: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  font: PDFFont;
}) {
  const { pdf, page, bytes, mimeType, label, x, y, w, h, font } = args;

  drawText(page, label, x, y + h + 9, 8, font);

  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: rgb(0.82, 0.84, 0.88),
    borderWidth: 0.8,
    color: rgb(1, 1, 1),
  });

  if (!bytes) {
    drawText(page, "Missing", x + 8, y + h / 2, 9, font, rgb(0.45, 0.45, 0.5));
    return;
  }

  try {
    const lower = mimeType.toLowerCase();
    const img = lower.includes("png")
      ? await pdf.embedPng(bytes)
      : await pdf.embedJpg(bytes);

    const scale = Math.min((w - 8) / img.width, (h - 8) / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;

    page.drawImage(img, {
      x: x + (w - iw) / 2,
      y: y + (h - ih) / 2,
      width: iw,
      height: ih,
    });
  } catch {
    drawText(page, "Preview unavailable", x + 8, y + h / 2, 8, font, rgb(0.45, 0.45, 0.5));
  }
}

async function buildPdf(args: {
  rows: ReportRow[];
  attachmentsByReport: Map<string, AttachmentRow[]>;
  weekStart: string;
  weekEnd: string;
  generatedAt: Date;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const width = 792;
  const height = 612;
  const margin = 32;

  let page = pdf.addPage([width, height]);
  let y = height - margin;

  drawText(page, "New Drop Billing Packet", margin, y, 18, bold);
  y -= 20;
  drawText(page, "Single Job Billing Packet", margin, y, 10, font, rgb(0.35, 0.35, 0.4));
  drawText(page, "Approved New Drop", 330, y, 10, bold);
  drawText(page, `Generated: ${fmtTimestamp(args.generatedAt)}`, 500, y, 10, font, rgb(0.35, 0.35, 0.4));
  y -= 24;

  for (const row of args.rows) {
    const attachments = args.attachmentsByReport.get(row.report_id) ?? [];
    const presentEvidenceCount = EVIDENCE.filter((item) =>
      attachments.some((a) => a.photo_label_key === item.key && !a.deleted_at),
    ).length;

    const gridCols = 2;
    const gridGap = 10;
    const gridX = margin + 12;
    const gridW = width - margin * 2 - 24;
    const boxW = (gridW - gridGap * (gridCols - 1)) / gridCols;
    const boxH = EVIDENCE.length <= 4 ? 145 : 118;
    const gridRows = Math.ceil(EVIDENCE.length / gridCols);
    const metaBlockH = 82;
    const gridHeight = gridRows * boxH + (gridRows - 1) * gridGap;
    const cardH = metaBlockH + gridHeight + 22;

    if (y - cardH < margin) {
      page = pdf.addPage([width, height]);
      y = height - margin;
    }

    page.drawRectangle({
      x: margin,
      y: y - cardH,
      width: width - margin * 2,
      height: cardH,
      borderColor: rgb(0.82, 0.84, 0.88),
      borderWidth: 0.8,
      color: rgb(1, 1, 1),
    });

    const top = y - 18;

    drawText(page, `JOB ${row.job_number ?? "—"}`, margin + 12, top, 15, bold);
    drawText(
      page,
      `Tech: ${row.subject_tech_id ?? "—"} • ${row.subject_full_name ?? "Unknown Technician"}`,
      margin + 12,
      top - 16,
      9,
      bold,
    );

    drawText(page, "APPROVED", width - margin - 78, top, 9, bold, rgb(0, 0.45, 0.16));
    drawText(page, fmtDate(row.approved_at), width - margin - 78, top - 14, 9, font, rgb(0.35, 0.35, 0.4));

    const metaY = top - 42;
    drawText(page, `Type: New Drop • ${(row.job_type ?? "—").toUpperCase()}`, margin + 12, metaY, 8, font);
    drawText(page, `Submitted: ${fmtDate(row.submitted_at)}`, margin + 250, metaY, 8, font);
    drawText(page, `Evidence: ${presentEvidenceCount}/${EVIDENCE.length}`, margin + 430, metaY, 8, bold);

    const gridTopY = metaY - 18;

    for (let i = 0; i < EVIDENCE.length; i += 1) {
      const item = EVIDENCE[i];
      const att = attachments.find((a) => a.photo_label_key === item.key && !a.deleted_at);
      const downloaded = await downloadAttachmentBytes(supabaseAdmin(), att);
      const col = i % gridCols;
      const rowIndex = Math.floor(i / gridCols);

      await drawImageBox({
        pdf,
        page,
        bytes: downloaded?.bytes ?? null,
        mimeType: downloaded?.mimeType ?? "",
        label: item.label,
        x: gridX + col * (boxW + gridGap),
        y: gridTopY - (rowIndex + 1) * boxH - rowIndex * gridGap,
        w: boxW,
        h: boxH,
        font: bold,
      });
    }

    y -= cardH + 12;
  }

  return pdf.save();
}

export async function GET(req: NextRequest) {
  const reportId = req.nextUrl.searchParams.get("report_id")?.trim();

  if (!reportId) return badRequest("report_id is required.");

  const supabase = supabaseAdmin();

  const { data: rowData, error: rowError } = await supabase
    .from("field_log_report")
    .select("report_id,job_number,job_type,status,submitted_at,approved_at,subject_full_name,subject_tech_id,gps_lat,gps_lng,gps_accuracy_m,location_captured_at,pc_org_id,category_key")
    .eq("report_id", reportId)
    .maybeSingle();

  if (rowError) {
    return NextResponse.json({ ok: false, error: rowError.message }, { status: 500 });
  }

  if (!rowData) {
    return NextResponse.json({ ok: false, error: "New Drop report not found." }, { status: 404 });
  }

  if (rowData.category_key !== "new_drop") {
    return NextResponse.json({ ok: false, error: "Report is not a New Drop." }, { status: 400 });
  }

  if (rowData.status !== "approved") {
    return NextResponse.json({ ok: false, error: "Only approved New Drops can generate billing packets." }, { status: 400 });
  }

  try {
    await requireAccessPass(req, String(rowData.pc_org_id));
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Forbidden" },
      { status: err?.status || 403 },
    );
  }

  const rows = [rowData as ReportRow];
  const attachmentsByReport = new Map<string, AttachmentRow[]>();

  const { data: attData, error: attError } = await supabase
    .from("field_log_attachment")
    .select("report_id,photo_label_key,file_path,file_name,mime_type,deleted_at")
    .eq("report_id", reportId)
    .is("deleted_at", null);

  if (attError) {
    return NextResponse.json({ ok: false, error: attError.message }, { status: 500 });
  }

  attachmentsByReport.set(reportId, (attData ?? []) as AttachmentRow[]);

  const generatedAt = new Date();
  const pdfBytes = await buildPdf({
    rows,
    attachmentsByReport,
    weekStart: "",
    weekEnd: "",
    generatedAt,
  });

  const jobNumber = sanitizeFilePart(String(rowData.job_number ?? reportId));
  const filename = `NewDrop_${jobNumber}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

