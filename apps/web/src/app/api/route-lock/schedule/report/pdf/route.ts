import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { addDaysISO, todayInNY, weekdayKey } from "@/features/route-lock/calendar/lib/fiscalMonth";

export const runtime = "nodejs";

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "sun", label: "Sun" },
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
];

type Rollup = {
  techDays: Record<DayKey, number>;
  eight: Record<DayKey, number>;
  ten: Record<DayKey, number>;
  hours: Record<DayKey, number>;
  totalTechDays: number;
  totalEight: number;
  totalTen: number;
  totalHours: number;
  fiveDayTechs: number;
  sixDayTechs: number;
  sevenDayTechs: number;
};

function emptyDayRecord() {
  return { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 } satisfies Record<DayKey, number>;
}

function n(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function fmt(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function deltaLabel(value: number) {
  if (value > 0) return `+${fmt(value)}`;
  return fmt(value);
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function dateLabel(start: string, end: string) {
  return `${start} to ${end}`;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function firstNumber(row: any, keys: string[]) {
  for (const key of keys) {
    const value = n(row?.[key]);
    if (value > 0) return value;
  }
  return 0;
}

function factHours(row: any) {
  const explicitHours = firstNumber(row, [
    "planned_hours",
    "schedule_hours",
    "scheduled_hours",
    "baseline_hours",
    "sch_hours",
    "shift_hours",
    "hours",
  ]);

  if (explicitHours > 0) return explicitHours;

  const explicitUnits = firstNumber(row, [
    "planned_units",
    "schedule_units",
    "scheduled_units",
    "baseline_units",
    "sch_units",
    "units",
  ]);

  if (explicitUnits > 0) return explicitUnits / 12;

  return 8;
}

function isScheduledFact(row: any) {
  if (row?.is_scheduled === false) return false;
  if (row?.is_baseline_day === false && !row?.planned_route_id && !row?.plan_source) return false;

  const techId = clean(row?.tech_id ?? row?.tech_num);
  if (!techId) return false;

  const source = clean(row?.plan_source).toLowerCase();
  if (source === "off" || source === "not_scheduled" || source === "not scheduled") return false;

  return true;
}

function rollupFacts(rows: any[]): Rollup {
  const out: Rollup = {
    techDays: emptyDayRecord(),
    eight: emptyDayRecord(),
    ten: emptyDayRecord(),
    hours: emptyDayRecord(),
    totalTechDays: 0,
    totalEight: 0,
    totalTen: 0,
    totalHours: 0,
    fiveDayTechs: 0,
    sixDayTechs: 0,
    sevenDayTechs: 0,
  };

  const datesByTech = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!isScheduledFact(row)) continue;

    const shiftDate = clean(row?.shift_date).slice(0, 10);
    if (!shiftDate) continue;

    const techId = clean(row?.tech_id ?? row?.tech_num);
    const day = weekdayKey(shiftDate);
    const hours = factHours(row);

    out.techDays[day] += 1;
    out.hours[day] += hours;
    out.totalTechDays += 1;
    out.totalHours += hours;

    if (hours >= 9.5) {
      out.ten[day] += 1;
      out.totalTen += 1;
    } else {
      out.eight[day] += 1;
      out.totalEight += 1;
    }

    const existing = datesByTech.get(techId) ?? new Set<string>();
    existing.add(shiftDate);
    datesByTech.set(techId, existing);
  }

  for (const dates of datesByTech.values()) {
    if (dates.size === 5) out.fiveDayTechs += 1;
    if (dates.size === 6) out.sixDayTechs += 1;
    if (dates.size >= 7) out.sevenDayTechs += 1;
  }

  return out;
}

function diff(next: Rollup, previous: Rollup): Rollup {
  const out: Rollup = {
    techDays: emptyDayRecord(),
    eight: emptyDayRecord(),
    ten: emptyDayRecord(),
    hours: emptyDayRecord(),
    totalTechDays: next.totalTechDays - previous.totalTechDays,
    totalEight: next.totalEight - previous.totalEight,
    totalTen: next.totalTen - previous.totalTen,
    totalHours: next.totalHours - previous.totalHours,
    fiveDayTechs: next.fiveDayTechs - previous.fiveDayTechs,
    sixDayTechs: next.sixDayTechs - previous.sixDayTechs,
    sevenDayTechs: next.sevenDayTechs - previous.sevenDayTechs,
  };

  for (const d of DAYS) {
    out.techDays[d.key] = next.techDays[d.key] - previous.techDays[d.key];
    out.eight[d.key] = next.eight[d.key] - previous.eight[d.key];
    out.ten[d.key] = next.ten[d.key] - previous.ten[d.key];
    out.hours[d.key] = next.hours[d.key] - previous.hours[d.key];
  }

  return out;
}

function drawText(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color = rgb(0.08, 0.1, 0.18)) {
  page.drawText(text, { x, y, size, font, color });
}

function drawCell(args: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  font: PDFFont;
  size?: number;
  align?: "left" | "right" | "center";
  muted?: boolean;
}) {
  const { page, text, x, y, w, h, font, size = 8, align = "left", muted = false } = args;
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: rgb(0.86, 0.88, 0.91),
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
  });

  const value = String(text ?? "");
  const textWidth = font.widthOfTextAtSize(value, size);
  const tx = align === "right" ? x + w - textWidth - 4 : align === "center" ? x + (w - textWidth) / 2 : x + 4;
  drawText(page, value, tx, y + h / 2 - size / 2 + 1, size, font, muted ? rgb(0.42, 0.45, 0.5) : rgb(0.08, 0.1, 0.18));
}

function drawSummaryTable(args: {
  page: PDFPage;
  y: number;
  previous: Rollup;
  next: Rollup;
  delta: Rollup;
  font: PDFFont;
  bold: PDFFont;
}) {
  const { page, previous, next, delta, font, bold } = args;
  const margin = 36;
  const rowH = 15;
  const labelW = 190;
  const colW = 82;

  let y = args.y;

  drawText(page, "EXECUTIVE SUMMARY", margin, y, 11, bold);
  y -= 18;

  drawCell({ page, text: "Metric", x: margin, y, w: labelW, h: rowH, font: bold, size: 8 });
  drawCell({ page, text: "Previous 7", x: margin + labelW, y, w: colW, h: rowH, font: bold, size: 8, align: "right" });
  drawCell({ page, text: "Next 7", x: margin + labelW + colW, y, w: colW, h: rowH, font: bold, size: 8, align: "right" });
  drawCell({ page, text: "Delta", x: margin + labelW + colW * 2, y, w: colW, h: rowH, font: bold, size: 8, align: "right" });

  y -= rowH;

  const rows = [
    ["Scheduled Days", previous.totalTechDays, next.totalTechDays, delta.totalTechDays],
    ["5-Day Techs", previous.fiveDayTechs, next.fiveDayTechs, delta.fiveDayTechs],
    ["6-Day Techs", previous.sixDayTechs, next.sixDayTechs, delta.sixDayTechs],
    ["7-Day Techs", previous.sevenDayTechs, next.sevenDayTechs, delta.sevenDayTechs],
    ["8 Hour Days", previous.totalEight, next.totalEight, delta.totalEight],
    ["10 Hour Days", previous.totalTen, next.totalTen, delta.totalTen],
    ["Scheduled Hours", previous.totalHours, next.totalHours, delta.totalHours],
  ] as const;

  for (const [label, previousValue, nextValue, deltaValue] of rows) {
    drawCell({ page, text: label, x: margin, y, w: labelW, h: rowH, font, size: 8 });
    drawCell({ page, text: fmt(previousValue), x: margin + labelW, y, w: colW, h: rowH, font, size: 8, align: "right" });
    drawCell({ page, text: fmt(nextValue), x: margin + labelW + colW, y, w: colW, h: rowH, font, size: 8, align: "right" });
    drawCell({ page, text: deltaLabel(deltaValue), x: margin + labelW + colW * 2, y, w: colW, h: rowH, font: bold, size: 8, align: "right" });
    y -= rowH;
  }

  return y - 16;
}

function drawDayComparisonTable(args: {
  page: PDFPage;
  title: string;
  y: number;
  previous: Record<DayKey, number>;
  next: Record<DayKey, number>;
  delta: Record<DayKey, number>;
  previousTotal: number;
  nextTotal: number;
  deltaTotal: number;
  font: PDFFont;
  bold: PDFFont;
}) {
  const { page, title, previous, next, delta, previousTotal, nextTotal, deltaTotal, font, bold } = args;
  const margin = 36;
  const rowH = 16;
  const labelW = 82;
  const dayW = 46;
  const totalW = 58;

  let y = args.y;

  drawText(page, title, margin, y, 11, bold);
  y -= 20;

  drawCell({ page, text: "", x: margin, y, w: labelW, h: rowH, font: bold, size: 7 });
  let x = margin + labelW;

  for (const d of DAYS) {
    drawCell({ page, text: d.label, x, y, w: dayW, h: rowH, font: bold, size: 7, align: "center" });
    x += dayW;
  }

  drawCell({ page, text: "Total", x, y, w: totalW, h: rowH, font: bold, size: 7, align: "center" });
  y -= rowH;

  const rows = [
    ["Previous", previous, previousTotal, false],
    ["Next", next, nextTotal, false],
    ["Delta", delta, deltaTotal, true],
  ] as const;

  for (const [label, values, total, isDelta] of rows) {
    drawCell({ page, text: label, x: margin, y, w: labelW, h: rowH, font: isDelta ? bold : font, size: 8 });
    x = margin + labelW;

    for (const d of DAYS) {
      const value = values[d.key];
      drawCell({
        page,
        text: isDelta ? deltaLabel(value) : fmt(value),
        x,
        y,
        w: dayW,
        h: rowH,
        font,
        size: 8,
        align: "right",
      });
      x += dayW;
    }

    drawCell({
      page,
      text: isDelta ? deltaLabel(total) : fmt(total),
      x,
      y,
      w: totalW,
      h: rowH,
      font: bold,
      size: 8,
      align: "right",
    });

    y -= rowH;
  }

  return y - 16;
}

function drawCapacityTable(args: {
  page: PDFPage;
  y: number;
  previous: Rollup;
  next: Rollup;
  delta: Rollup;
  font: PDFFont;
  bold: PDFFont;
}) {
  const { page, previous, next, delta, font, bold } = args;
  const margin = 36;
  const rowH = 15;
  const metricW = 78;
  const labelW = 70;
  const dayW = 42;
  const totalW = 54;

  let y = args.y;

  drawText(page, "CAPACITY", margin, y, 11, bold);
  y -= 20;

  drawCell({ page, text: "Metric", x: margin, y, w: metricW, h: rowH, font: bold, size: 7 });
  drawCell({ page, text: "", x: margin + metricW, y, w: labelW, h: rowH, font: bold, size: 7 });

  let x = margin + metricW + labelW;
  for (const d of DAYS) {
    drawCell({ page, text: d.label, x, y, w: dayW, h: rowH, font: bold, size: 7, align: "center" });
    x += dayW;
  }
  drawCell({ page, text: "Total", x, y, w: totalW, h: rowH, font: bold, size: 7, align: "center" });

  y -= rowH;

  const groups = [
    ["8 Hour", previous.eight, next.eight, delta.eight, previous.totalEight, next.totalEight, delta.totalEight],
    ["10 Hour", previous.ten, next.ten, delta.ten, previous.totalTen, next.totalTen, delta.totalTen],
    ["Hours", previous.hours, next.hours, delta.hours, previous.totalHours, next.totalHours, delta.totalHours],
  ] as const;

  for (const [metric, previousValues, nextValues, deltaValues, previousTotal, nextTotal, deltaTotal] of groups) {
    const rows = [
      ["Previous", previousValues, previousTotal, false],
      ["Next", nextValues, nextTotal, false],
      ["Delta", deltaValues, deltaTotal, true],
    ] as const;

    for (let i = 0; i < rows.length; i += 1) {
      const [label, values, total, isDelta] = rows[i];

      drawCell({ page, text: i === 0 ? metric : "", x: margin, y, w: metricW, h: rowH, font: i === 0 ? bold : font, size: 7 });
      drawCell({ page, text: label, x: margin + metricW, y, w: labelW, h: rowH, font: isDelta ? bold : font, size: 7 });

      x = margin + metricW + labelW;
      for (const d of DAYS) {
        const value = values[d.key];
        drawCell({
          page,
          text: isDelta ? deltaLabel(value) : fmt(value),
          x,
          y,
          w: dayW,
          h: rowH,
          font,
          size: 7,
          align: "right",
        });
        x += dayW;
      }

      drawCell({
        page,
        text: isDelta ? deltaLabel(total) : fmt(total),
        x,
        y,
        w: totalW,
        h: rowH,
        font: bold,
        size: 7,
        align: "right",
      });

      y -= rowH;
    }
  }

  return y - 14;
}

async function guardCanReadRouteLock(pcOrgId: string) {
  const sb = await supabaseServer();

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) return { ok: false as const, status: 401, error: "unauthorized" };

  const { data: isOwner, error: ownerErr } = await sb.rpc("is_owner");
  if (ownerErr) return { ok: false as const, status: 403, error: "forbidden" };
  if (isOwner) return { ok: true as const };

  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;
  const { data: allowed, error: permErr } = await apiClient.rpc("has_any_pc_org_permission", {
    p_pc_org_id: pcOrgId,
    p_permission_keys: ["route_lock_manage", "roster_manage"],
  });

  if (permErr || !allowed) return { ok: false as const, status: 403, error: "forbidden" };

  return { ok: true as const };
}

async function loadScheduleFacts(admin: ReturnType<typeof supabaseAdmin>, pcOrgId: string, start: string, end: string) {
  const { data, error } = await admin
    .from("schedule_day_fact")
    .select("*")
    .eq("pc_org_id", pcOrgId)
    .gte("shift_date", start)
    .lte("shift_date", end);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function GET(req: NextRequest) {
  try {
    const admin = supabaseAdmin();
    const pcOrgId = req.nextUrl.searchParams.get("pc_org_id")?.trim();

    if (!pcOrgId) {
      return NextResponse.json({ ok: false, error: "Missing required pc_org_id" }, { status: 400 });
    }

    const guard = await guardCanReadRouteLock(pcOrgId);
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

    const today = todayInNY();
    const previousStart = addDaysISO(today, -7);
    const previousEnd = addDaysISO(today, -1);
    const nextStart = today;
    const nextEnd = addDaysISO(today, 6);

    const [previousRows, nextRows] = await Promise.all([
      loadScheduleFacts(admin, pcOrgId, previousStart, previousEnd),
      loadScheduleFacts(admin, pcOrgId, nextStart, nextEnd),
    ]);

    const previous = rollupFacts(previousRows);
    const next = rollupFacts(nextRows);
    const delta = diff(next, previous);

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const page = pdf.addPage([612, 792]);
    const margin = 32;
    let y = 752;

    const { data: pcOrgRaw } = await admin
      .from("pc_org")
      .select("pc_org_id,pc_org_name,region_id,pc:pc_id(pc_number),region:region_id(region_name)")
      .eq("pc_org_id", pcOrgId)
      .maybeSingle();

    const pcOrg: any = pcOrgRaw ?? {};
    const companyName = clean(pcOrg?.pc_org_name);
    const pcNumber = clean(pcOrg?.pc?.pc_number) || clean(companyName.match(/\b\d{3}\b/)?.[0]);
    const regionName = clean(pcOrg?.region?.region_name);

    drawText(page, "Schedule Baseline Comparison", margin, y, 17, bold);
    y -= 22;

    const identityParts = [pcNumber ? `PC ${pcNumber}` : "", companyName && companyName !== pcNumber ? companyName : ""].filter(Boolean);

    if (identityParts.length > 0) {
      drawText(page, identityParts.join(" • "), margin, y, 9, bold);
      y -= 13;
    }

    if (regionName) {
      drawText(page, regionName, margin, y, 8, font, rgb(0.35, 0.35, 0.4));
      y -= 14;
    }

    drawText(page, `Previous 7 Days: ${dateLabel(previousStart, previousEnd)}`, margin, y, 8, font, rgb(0.35, 0.35, 0.4));
    drawText(page, `Next 7 Days: ${dateLabel(nextStart, nextEnd)}`, margin + 210, y, 8, font, rgb(0.35, 0.35, 0.4));
    drawText(page, `Generated: ${new Date().toLocaleString("en-US")}`, margin + 390, y, 8, font, rgb(0.35, 0.35, 0.4));
    y -= 28;

    y = drawSummaryTable({ page, y, previous, next, delta, font, bold });

    y = drawDayComparisonTable({
      page,
      title: "COVERAGE",
      y,
      previous: previous.techDays,
      next: next.techDays,
      delta: delta.techDays,
      previousTotal: previous.totalTechDays,
      nextTotal: next.totalTechDays,
      deltaTotal: delta.totalTechDays,
      font,
      bold,
    });

    y = drawCapacityTable({ page, y, previous, next, delta, font, bold });

    drawText(
      page,
      "Baseline comparison by 7-day operating window. Delta = Next 7 Days minus Previous 7 Days.",
      margin,
      36,
      8,
      font,
      rgb(0.42, 0.45, 0.5),
    );

    const bytes = await pdf.save();
    const filename = `schedule-baseline-comparison_${safeFilePart(nextStart)}_to_${safeFilePart(nextEnd)}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to build report" },
      { status: 500 },
    );
  }
}
