// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/route-lock/check-in/upload/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import * as XLSX from "xlsx";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ok = {
  ok: true;
  row_count_loaded: number;
  row_count_total: number;
  fulfillment_center_id: number;
  batch_id?: string | null;
  min_cp_date?: string | null;
  max_cp_date?: string | null;
  day_fact_rows?: number;
  today_ny?: string;
  filtered_out_today_or_future?: number;
};

type Err = { ok: false; error: string; hint?: string; expected?: any; received?: any; detail?: any };

function json(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function todayInNY(): string {
  // YYYY-MM-DD in America/New_York
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function asText(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

/**
 * Normalize ID-ish values that can arrive as numbers or "123.0".
 */
function normalizeId(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;

  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    const s = String(v);
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  }

  const s = String(v).trim();
  if (!s) return null;
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function asNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * IMPORTANT:
 * Use UTC-based YYYY-MM-DD for Date objects (avoids NY timezone shifting the day).
 */
function parseISODate(v: unknown): string | null {
  if (!v) return null;

  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }

  const s = String(v).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1]!.padStart(2, "0");
    const dd = m[2]!.padStart(2, "0");
    const yy = m[3]!;
    return `${yy}-${mm}-${dd}`;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

function parseTime(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;

  // Excel time serial (fraction of a day)
  if (typeof v === "number" && Number.isFinite(v)) {
    const totalSeconds = Math.round(v * 24 * 60 * 60);
    const hh = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, "0");
    const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  const s = String(v).trim();
  if (!s) return null;

  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hh = m[1]!.padStart(2, "0");
    const mm = m[2]!;
    const ss = (m[3] ?? "00").padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  return null;
}

/**
 * Job Duration comes in as:
 * - Excel duration serial (fraction of day) -> hours = v * 24
 * - String like "1:02" or "01:02:30" -> hours
 * - Sometimes already numeric hours
 */
function parseDurationHours(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;

  if (typeof v === "number" && Number.isFinite(v)) {
    // If vendor emits Excel time serial for duration, this is the right conversion.
    // If they already emit hours, this still usually stays reasonable (but in your sample it's a string "1:02").
    return v * 24;
  }

  if (v instanceof Date && !isNaN(v.getTime())) {
    // Rare, but treat as time-of-day duration and convert hh:mm:ss to hours
    const hh = v.getUTCHours();
    const mm = v.getUTCMinutes();
    const ss = v.getUTCSeconds();
    return hh + mm / 60 + ss / 3600;
  }

  const s = String(v).trim();
  if (!s) return null;

  // "H:MM" or "HH:MM" or "H:MM:SS"
  const m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = m[3] ? Number(m[3]) : 0;
    if (![hh, mm, ss].every((x) => Number.isFinite(x))) return null;
    return hh + mm / 60 + ss / 3600;
  }

  // Fallback numeric string
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function sheetToJson(workbook: XLSX.WorkBook, sheetName: string, opts?: XLSX.Sheet2JSONOpts) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null, ...(opts ?? {}) });
}

function getAny(row: Record<string, any>, keys: string[]): any {
  for (const k of keys) {
    if (k in row) return row[k];
    const trimmed = k.trim();
    if (trimmed !== k && trimmed in row) return row[trimmed];
  }

  const map = new Map<string, string>();
  for (const rk of Object.keys(row)) map.set(rk.trim(), rk);

  for (const k of keys) {
    const hit = map.get(k.trim());
    if (hit) return row[hit];
  }
  return undefined;
}

/**
 * A5 contains something like:
 * "Fulfillment Center189931101 - Keystone"
 */
function parseFulfillmentCenterFromA5(workbook: XLSX.WorkBook, sheetName: string) {
  const ws: any = workbook.Sheets[sheetName];
  if (!ws) return null;

  const cell: any = ws["A5"] ?? null;
  const raw = cell?.w ?? cell?.v ?? null;
  const line = raw === null || raw === undefined ? "" : String(raw).trim();
  if (!line) return null;

  const m = line.match(/Fulfillment\s*Center\s*:?\s*(\d+)/i) || line.match(/Fulfillment\s*Center(\d+)/i);
  if (!m) return null;

  const id = Number(m[1]);
  if (!Number.isFinite(id)) return null;

  const after = line.replace(m[0], "").trim();
  const name =
    after.includes("-") ? after.split("-").slice(1).join("-").trim() : after.startsWith("-") ? after.slice(1).trim() : null;

  return { id, name: name || null, label: line };
}

type ParsedRow = {
  tech_id: string;
  job_num: string;
  cp_date: string;
  work_order_number: string | null;
  account: string | null;
  job_type: string | null;
  job_units: number | null;
  time_slot_start_time: string | null;
  time_slot_end_time: string | null;
  start_time: string | null;
  cp_time: string | null;
  job_duration_hours: number | null; // ✅ normalized hours
  resolution_code: string | null;
  job_comment: string | null;
};

function buildXlsxRows(bytes: Uint8Array) {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { sheetName: null as string | null, fc: null as any, rows: [] as ParsedRow[], debug: { reason: "no_sheet" } };

  const fc = parseFulfillmentCenterFromA5(workbook, sheetName);

  // Headers are on row 10 (1-based) => range: 9 (0-based)
  const data = sheetToJson(workbook, sheetName, { range: 9 });

  const parsed: ParsedRow[] = [];

  for (const r of data as any[]) {
    const tech = normalizeId(getAny(r, ["Tech #", "Tech#", "tech_id", "Tech ID", "Technician", "Tech"]));
    const job = normalizeId(getAny(r, ["Job #", "Job#", "job_num", "Job Number", "Job"]));
    const cpDate = parseISODate(getAny(r, ["CP Date", "Cp Date", "cp_date", "Date", "Close Date"]));

    if (!tech || !job || !cpDate) continue;

    parsed.push({
      tech_id: tech,
      job_num: job,
      cp_date: cpDate,

      work_order_number: asText(getAny(r, ["Work Order Number", "Work Order #", "Work Order", "work_order_number"])),
      account: asText(getAny(r, ["Account", "account"])),
      job_type: asText(getAny(r, ["Job Type", "job_type"])),
      job_units: asNum(getAny(r, ["Job Units", "Units", "job_units"])),

      time_slot_start_time: parseTime(getAny(r, ["Time Slot Start Time", "Slot Start", "time_slot_start_time"])),
      time_slot_end_time: parseTime(getAny(r, ["Time Slot End Time", "Slot End", "time_slot_end_time"])),
      start_time: parseTime(getAny(r, ["Start Time", "start_time"])),
      cp_time: parseTime(getAny(r, ["CP Time", "Cp Time", "cp_time"])),

      // ✅ This is the fix: support "1:02" and similar
      job_duration_hours: parseDurationHours(getAny(r, ["Job Duration", "Duration", "job_duration"])),

      resolution_code: asText(getAny(r, ["Resolution Code", "resolution_code"])),
      job_comment: asText(getAny(r, ["Job Comment", "Comments", "job_comment"])),
    });
  }

  const ws: any = workbook.Sheets[sheetName];
  const a5cell = ws?.["A5"];
  const a5 = a5cell ? String(a5cell?.w ?? a5cell?.v ?? "") : null;

  return {
    sheetName,
    fc,
    rows: parsed,
    debug: {
      sheet: sheetName,
      range_start_row_1based: 10,
      row_count_scanned: (data as any[]).length,
      row_count_usable: parsed.length,
      a5,
    },
  };
}

type FiscalMonthRow = {
  fiscal_month_id: string;
  start_date: string;
  end_date: string; // IMPORTANT: this is the fiscal_end_date for the month in your model
  label?: string | null;
};

function resolveFiscalMonthForDate(iso: string, months: FiscalMonthRow[]): FiscalMonthRow | null {
  for (const m of months) {
    if (m.start_date <= iso && iso <= m.end_date) return m;
  }
  return null;
}

function dbErr(e: any) {
  if (!e) return null;
  return {
    message: String(e.message ?? e),
    details: e.details ?? null,
    hint: e.hint ?? null,
    code: e.code ?? null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireSelectedPcOrgServer();
    if (!scope.ok) return json(401, { ok: false, error: "no org selected" } satisfies Err);

    const sb = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (!user) return json(401, { ok: false, error: "not authenticated" } satisfies Err);

    const pc_org_id = scope.selected_pc_org_id;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json(400, { ok: false, error: "missing file" } satisfies Err);

    const filename = String((file as any).name ?? "upload");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const buf = Buffer.from(bytes);
    const fileHash = sha256(buf);

    // Org guardrail FC
    const { data: org, error: orgErr } = await admin
      .from("pc_org")
      .select("fulfillment_center_id")
      .eq("pc_org_id", pc_org_id)
      .maybeSingle();

    if (orgErr) return json(500, { ok: false, error: orgErr.message } satisfies Err);

    const expectedFC = (org?.fulfillment_center_id as number | null) ?? null;
    if (!expectedFC) {
      return json(400, {
        ok: false,
        error: "uploads disabled for this org",
        hint: "Populate public.pc_org.fulfillment_center_id to enable.",
      } satisfies Err);
    }

    const lower = filename.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      return json(400, {
        ok: false,
        error: "unsupported file type",
        hint: "Upload the vendor Check-In XLSX/XLS report (this endpoint expects the A5 fulfillment center header).",
      } satisfies Err);
    }

    const parsed = buildXlsxRows(bytes);

    if (!parsed.sheetName) return json(400, { ok: false, error: "no worksheet found", detail: parsed.debug } satisfies Err);

    // FC from A5 (authoritative)
    if (!parsed.fc) {
      return json(400, {
        ok: false,
        error: "could not parse fulfillment center from A5",
        hint: 'Expected cell A5 to contain: "Fulfillment Center189931101 - Keystone" (or similar).',
        expected: expectedFC,
        received: null,
        detail: parsed.debug,
      } satisfies Err);
    }

    if (Number(parsed.fc.id) !== Number(expectedFC)) {
      return json(400, {
        ok: false,
        error: "fulfillment center mismatch",
        hint: "This org is guarded by pc_org.fulfillment_center_id. Upload a file for the selected org’s FC.",
        expected: expectedFC,
        received: parsed.fc.id,
        detail: parsed.debug,
      } satisfies Err);
    }

    const todayNY = todayInNY();

    // ✅ Check-In is PAST DAYS ONLY: exclude today and future
    const allRows = parsed.rows;
    const ingestRows = allRows.filter((r) => r.cp_date < todayNY);
    const filteredOut = allRows.length - ingestRows.length;

    if (!ingestRows.length) {
      return json(400, {
        ok: false,
        error: "no usable rows found (past days only)",
        hint: "This endpoint ingests only cp_date < today (NY). Your report appears to include only today/future rows.",
        detail: { todayNY, total_rows_found: allRows.length, filtered_out_today_or_future: filteredOut, parse_debug: parsed.debug },
      } satisfies Err);
    }

    const row_count_total = ingestRows.length;
    const datesSorted = ingestRows.map((r) => r.cp_date).sort();
    const min_cp_date = datesSorted[0] ?? null;
    const max_cp_date = datesSorted[datesSorted.length - 1] ?? null;

    // ---- Fiscal Month Resolution (your real model: start_date/end_date) ----
    const { data: months, error: monthsErr } = await admin
      .from("fiscal_month_dim")
      .select("fiscal_month_id,start_date,end_date,label")
      .lte("start_date", max_cp_date)
      .gte("end_date", min_cp_date)
      .order("start_date", { ascending: true });

    if (monthsErr) {
      return json(500, { ok: false, error: "failed to resolve fiscal months", detail: dbErr(monthsErr) } satisfies Err);
    }

    const monthRows: FiscalMonthRow[] = (months ?? []).map((m: any) => ({
      fiscal_month_id: String(m.fiscal_month_id),
      start_date: String(m.start_date),
      end_date: String(m.end_date),
      label: m.label === null || m.label === undefined ? null : String(m.label),
    }));

    if (!monthRows.length) {
      return json(500, {
        ok: false,
        error: "failed to resolve fiscal months",
        hint: "No fiscal_month_dim rows overlap the upload date range.",
        detail: { min_cp_date, max_cp_date, todayNY },
      } satisfies Err);
    }

    // Validate every cp_date is covered
    const uniqueDates = Array.from(new Set(ingestRows.map((r) => r.cp_date))).sort();
    const missingDates: string[] = [];
    for (const d of uniqueDates) {
      if (!resolveFiscalMonthForDate(d, monthRows)) missingDates.push(d);
    }
    if (missingDates.length) {
      return json(500, {
        ok: false,
        error: "failed to resolve fiscal months",
        hint: "Some cp_date values were not covered by any fiscal_month_dim (start_date/end_date).",
        detail: { missing_dates: missingDates.slice(0, 100), min_cp_date, max_cp_date, todayNY, months: monthRows },
      } satisfies Err);
    }

    // ---- Create batch row ----
    const { data: batchIns, error: batchErr } = await admin
      .from("check_in_batch")
      .insert({
        pc_org_id,
        fulfillment_center_id: expectedFC,
        uploaded_by_auth_user_id: user.id,
        source_file_name: filename,
        source_hash: fileHash,
        row_count_total,
        row_count_loaded: 0,
        min_cp_date,
        max_cp_date,
      })
      .select("check_in_batch_id")
      .maybeSingle();

    if (batchErr || !batchIns?.check_in_batch_id) {
      return json(500, { ok: false, error: "failed to create batch", detail: dbErr(batchErr) } satisfies Err);
    }

    const check_in_batch_id = String(batchIns.check_in_batch_id);

    // ---- Upsert job rows (past-days-only rows) ----
    const jobRows = ingestRows.map((r) => ({
      pc_org_id,
      check_in_batch_id,
      fulfillment_center_id: expectedFC,
      tech_id: r.tech_id,
      job_num: r.job_num,
      work_order_number: r.work_order_number,
      account: r.account,
      job_type: r.job_type,
      job_units: r.job_units,
      time_slot_start_time: r.time_slot_start_time,
      time_slot_end_time: r.time_slot_end_time,
      start_time: r.start_time,
      cp_date: r.cp_date,
      cp_time: r.cp_time,
      // ✅ store normalized hours
      job_duration: r.job_duration_hours,
      resolution_code: r.resolution_code,
      job_comment: r.job_comment,
    }));

    let loaded = 0;
    const chunkSize = 750;
    for (let i = 0; i < jobRows.length; i += chunkSize) {
      const chunk = jobRows.slice(i, i + chunkSize);
      const { error: upErr } = await admin.from("check_in_job_row").upsert(chunk, {
        onConflict: "pc_org_id,job_num,cp_date,tech_id",
      });

      if (upErr) {
        await admin.from("check_in_batch").update({ row_count_loaded: loaded }).eq("check_in_batch_id", check_in_batch_id);
        return json(500, { ok: false, error: "failed to upsert job rows", detail: dbErr(upErr) } satisfies Err);
      }

      loaded += chunk.length;
    }

    // ---- Aggregate -> check_in_day_fact ----
    type Agg = {
      pc_org_id: string;
      shift_date: string;
      tech_id: string;
      fiscal_month_id: string;
      fiscal_end_date: string; // REQUIRED by table
      fulfillment_center_id: number;
      actual_jobs: number;
      actual_units: number; // numeric not null
      actual_hours: number; // numeric not null
      first_start_time: string | null;
      last_cp_time: string | null;
    };

    const agg = new Map<string, Agg>();

    for (const r of ingestRows) {
      const fm = resolveFiscalMonthForDate(r.cp_date, monthRows)!;

      const key = `${pc_org_id}::${r.cp_date}::${r.tech_id}`;
      const cur =
        agg.get(key) ??
        ({
          pc_org_id,
          shift_date: r.cp_date,
          tech_id: r.tech_id,
          fiscal_month_id: fm.fiscal_month_id,
          fiscal_end_date: fm.end_date, // ✅ end_date is your fiscal_end_date
          fulfillment_center_id: expectedFC,
          actual_jobs: 0,
          actual_units: 0,
          actual_hours: 0,
          first_start_time: null,
          last_cp_time: null,
        } satisfies Agg);

      cur.actual_jobs += 1;
      cur.actual_units += r.job_units ?? 0;
      cur.actual_hours += r.job_duration_hours ?? 0;

      if (r.start_time) {
        if (!cur.first_start_time || r.start_time < cur.first_start_time) cur.first_start_time = r.start_time;
      }
      if (r.cp_time) {
        if (!cur.last_cp_time || r.cp_time > cur.last_cp_time) cur.last_cp_time = r.cp_time;
      }

      agg.set(key, cur);
    }

    const dayFacts = Array.from(agg.values()).map((a) => ({
      pc_org_id: a.pc_org_id,
      shift_date: a.shift_date,
      tech_id: a.tech_id,
      fiscal_month_id: a.fiscal_month_id,
      fiscal_end_date: a.fiscal_end_date,
      fulfillment_center_id: a.fulfillment_center_id,
      actual_jobs: a.actual_jobs,
      actual_units: a.actual_units,
      actual_hours: a.actual_hours,
      first_start_time: a.first_start_time,
      last_cp_time: a.last_cp_time,
      updated_at: new Date().toISOString(),
    }));

    const dfChunk = 1000;
    for (let i = 0; i < dayFacts.length; i += dfChunk) {
      const chunk = dayFacts.slice(i, i + dfChunk);
      const { error: dfErr } = await admin.from("check_in_day_fact").upsert(chunk, {
        onConflict: "pc_org_id,shift_date,tech_id",
      });

      if (dfErr) {
        return json(500, {
          ok: false,
          error: "failed to upsert day facts",
          detail: {
            db_error: dbErr(dfErr),
            onConflict: "pc_org_id,shift_date,tech_id",
            sample_rows: chunk.slice(0, 5),
          },
        } satisfies Err);
      }
    }

    await admin
      .from("check_in_batch")
      .update({ row_count_loaded: loaded, min_cp_date, max_cp_date })
      .eq("check_in_batch_id", check_in_batch_id);

    return json(200, {
      ok: true,
      row_count_loaded: loaded,
      row_count_total,
      fulfillment_center_id: expectedFC,
      batch_id: check_in_batch_id,
      min_cp_date,
      max_cp_date,
      day_fact_rows: dayFacts.length,
      today_ny: todayNY,
      filtered_out_today_or_future: filteredOut,
    } satisfies Ok);
  } catch (e: any) {
    return json(500, { ok: false, error: String(e?.message ?? e), detail: e?.stack ? String(e.stack) : undefined } satisfies Err);
  }
}