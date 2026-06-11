import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import * as XLSX from "xlsx";
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
  drawText(page, `Range: ${args.weekStart} through ${args.weekEnd}`, margin, y, 10, font, rgb(0.35, 0.35, 0.4));
  drawText(page, `Approved Drops: ${args.rows.length}`, 330, y, 10, bold);
  drawText(page, `Generated: ${fmtTimestamp(args.generatedAt)}`, 500, y, 10, font, rgb(0.35, 0.35, 0.4));
  y -= 24;

  for (const row of args.rows) {
    const cardH = 170;
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

    const metaY = top - 38;
    drawText(page, `Type: New Drop • ${(row.job_type ?? "—").toUpperCase()}`, margin + 12, metaY, 8, font);
    drawText(page, `Submitted: ${fmtDate(row.submitted_at)}`, margin + 210, metaY, 8, font);
    drawText(page, "Evidence: 4/4", margin + 390, metaY, 8, bold);

    const attachments = args.attachmentsByReport.get(row.report_id) ?? [];
    const colGap = 8;
    const boxW = (width - margin * 2 - 24 - colGap * 3) / 4;
    const boxH = 78;
    const boxY = y - cardH + 18;

    for (let i = 0; i < EVIDENCE.length; i += 1) {
      const item = EVIDENCE[i];
      const att = attachments.find((a) => a.photo_label_key === item.key && !a.deleted_at);
      const downloaded = await downloadAttachmentBytes(supabaseAdmin(), att);
      await drawImageBox({
        pdf,
        page,
        bytes: downloaded?.bytes ?? null,
        mimeType: downloaded?.mimeType ?? "",
        label: item.label,
        x: margin + 12 + i * (boxW + colGap),
        y: boxY,
        w: boxW,
        h: boxH,
        font: bold,
      });
    }

    y -= cardH + 12;
  }

  return pdf.save();
}

function buildXlsx(args: {
  rows: ReportRow[];
  attachmentsByReport: Map<string, AttachmentRow[]>;
  weekStart: string;
  weekEnd: string;
}) {
  const data = args.rows.map((row) => {
    const attachments = args.attachmentsByReport.get(row.report_id) ?? [];
    const has = (key: string) =>
      attachments.some((a) => a.photo_label_key === key && !a.deleted_at) ? "YES" : "NO";

    return {
      "Week Start": args.weekStart,
      "Week End": args.weekEnd,
      "Job Number": row.job_number ?? "",
      "Job Type": (row.job_type ?? "").toUpperCase(),
      "Tech ID": row.subject_tech_id ?? "",
      Technician: row.subject_full_name ?? "",
      Status: row.status ?? "",
      Submitted: fmtDate(row.submitted_at),
      Approved: fmtDate(row.approved_at),
      "GPS Latitude": row.gps_lat ?? "",
      "GPS Longitude": row.gps_lng ?? "",
      "GPS Accuracy M": gpsAccuracyDisplay(row.gps_accuracy_m),
      "GPS Quality": gpsQuality(row.gps_accuracy_m),
      "Location Captured At": fmtDate(row.location_captured_at),
      "Map Link":
        row.gps_lat != null && row.gps_lng != null
          ? `https://www.google.com/maps?q=${row.gps_lat},${row.gps_lng}`
          : "",
      "Tap Photo": has("tap_photo"),
      "Ground Block Photo": has("ground_block_photo"),
      "Bond Point Photo": has("bond_point_photo"),
      "Workorder Snapshot": has("workorder_snapshot"),
      "Report ID": row.report_id,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 28 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 20 }, { wch: 48 }, { wch: 10 }, { wch: 18 }, { wch: 18 },
    { wch: 20 }, { wch: 38 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "New Drops");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function GET(req: NextRequest) {
  const pcOrgId = req.nextUrl.searchParams.get("pc_org_id")?.trim();
  const start = req.nextUrl.searchParams.get("start")?.trim();
  const end = req.nextUrl.searchParams.get("end")?.trim();

  if (!pcOrgId) return badRequest("pc_org_id is required.");
  if (!start) return badRequest("start is required.");
  if (!end) return badRequest("end is required.");

  try {
    await requireAccessPass(req, pcOrgId);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Forbidden" },
      { status: err?.status || 403 },
    );
  }

  const supabase = supabaseAdmin();
  const startIso = `${start}T00:00:00.000Z`;
  const endIso = `${end}T23:59:59.999Z`;

  const { data: rowsData, error: rowsError } = await supabase
    .from("field_log_report")
    .select("report_id,job_number,job_type,status,submitted_at,approved_at,subject_full_name,subject_tech_id,gps_lat,gps_lng,gps_accuracy_m,location_captured_at")
    .eq("pc_org_id", pcOrgId)
    .eq("category_key", "new_drop")
    .eq("status", "approved")
    .gte("approved_at", startIso)
    .lte("approved_at", endIso)
    .order("approved_at", { ascending: true });

  if (rowsError) {
    return NextResponse.json({ ok: false, error: rowsError.message }, { status: 500 });
  }

  const rows = (rowsData ?? []) as ReportRow[];
  const reportIds = rows.map((r) => r.report_id);

  const attachmentsByReport = new Map<string, AttachmentRow[]>();

  if (reportIds.length) {
    const { data: attData, error: attError } = await supabase
      .from("field_log_attachment")
      .select("report_id,photo_label_key,file_path,file_name,mime_type,deleted_at")
      .in("report_id", reportIds)
      .is("deleted_at", null);

    if (attError) {
      return NextResponse.json({ ok: false, error: attError.message }, { status: 500 });
    }

    for (const att of (attData ?? []) as AttachmentRow[]) {
      const list = attachmentsByReport.get(att.report_id) ?? [];
      list.push(att);
      attachmentsByReport.set(att.report_id, list);
    }
  }

  const generatedAt = new Date();
  const pdfBytes = await buildPdf({ rows, attachmentsByReport, weekStart: start, weekEnd: end, generatedAt });
  const xlsxBytes = buildXlsx({ rows, attachmentsByReport, weekStart: start, weekEnd: end });

  const base = `NewDropPacket_${sanitizeFilePart(start)}_to_${sanitizeFilePart(end)}`;
  const zip = new JSZip();
  zip.file(`${base}.pdf`, pdfBytes);
  zip.file(`${base}.xlsx`, xlsxBytes);

  const zipBytes = await zip.generateAsync({ type: "uint8array" });

  return new NextResponse(Buffer.from(zipBytes), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${base}.zip"`,
      "cache-control": "no-store",
    },
  });
}
