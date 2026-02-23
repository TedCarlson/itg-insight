// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/route-lock/check-in/upload/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";

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

  // ✅ New rule: return orchestrator sweeps per fiscal month touched
  sweeps?: Record<string, any>;
};

type Err = { ok: false; error: string; hint?: string; expected?: any; received?: any; detail?: any };

function normHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function asText(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function asNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function asInt(v: unknown): number | null {
  const n = asNum(v);
  return n === null ? null : Math.trunc(n);
}

function parseISODate(v: unknown): string | null {
  if (!v) return null;

  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(v);
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

  return null;
}

function parseTime(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;

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

// Fiscal rule: months start on 22nd and end on 21st.
function fiscalEndDateFor(isoDate: string): string {
  const [yStr, mStr, dStr] = isoDate.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);

  const toISO = (yy: number, mm: number, dd: number) =>
    `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;

  if (d <= 21) return toISO(y, m, 21);

  let yy = y;
  let mm = m + 1;
  if (mm === 13) {
    mm = 1;
    yy += 1;
  }
  return toISO(yy, mm, 21);
}

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function readSpreadsheetRows(fileName: string, buf: Buffer): Promise<Record<string, any>[]> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = require("xlsx") as typeof import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const wsName = wb.SheetNames[0];
    if (!wsName) return [];
    const ws = wb.Sheets[wsName];
    return XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null });
  }

  if (lower.endsWith(".csv")) {
    const text = buf.toString("utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const splitCsvLine = (line: string) => {
      const out: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQ = !inQ;
          }
        } else if (ch === "," && !inQ) {
          out.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };

    const headers = splitCsvLine(lines[0]!).map((h) => h);
    const rows: Record<string, any>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = splitCsvLine(lines[i]!);
      const row: Record<string, any> = {};
      for (let c = 0; c < headers.length; c++) row[headers[c] ?? `col_${c}`] = parts[c] ?? null;
      rows.push(row);
    }
    return rows;
  }

  throw new Error("Unsupported file type. Please upload .xlsx, .xls, or .csv");
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireSelectedPcOrgServer();
    if (!scope.ok) return NextResponse.json<Err>({ ok: false, error: "no org selected" }, { status: 401 });

    const sb = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (!user) return NextResponse.json<Err>({ ok: false, error: "not authenticated" }, { status: 401 });

    const pc_org_id = scope.selected_pc_org_id;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json<Err>({ ok: false, error: "missing file" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const fileHash = sha256(buf);

    // Guardrail: org FC
    const { data: org } = await admin
      .from("pc_org")
      .select("fulfillment_center_id")
      .eq("pc_org_id", pc_org_id)
      .maybeSingle();

    const expectedFC = (org?.fulfillment_center_id as number | null) ?? null;
    if (!expectedFC) {
      return NextResponse.json<Err>(
        { ok: false, error: "uploads disabled for this org", hint: "Populate public.pc_org.fulfillment_center_id to enable." },
        { status: 400 }
      );
    }

    const rawRows = await readSpreadsheetRows(file.name, buf);

    const parsed: Array<{
      fulfillment_center_id: number | null;
      tech_id: string;
      job_num: string;
      work_order_number: string | null;
      account: string | null;
      job_type: string | null;
      job_units: number | null;
      time_slot_start_time: string | null;
      time_slot_end_time: string | null;
      start_time: string | null;
      cp_date: string;
      cp_time: string | null;
      job_duration: number | null;
      resolution_code: string | null;
      job_comment: string | null;
    }> = [];

    for (const r of rawRows) {
      const by: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) by[normHeader(k)] = v;

      const tech_id = asText(by.tech_id ?? by.tech ?? by.techid ?? by.tech_number ?? by.tech_num);
      const job_num = asText(by.job_num ?? by.jobnumber ?? by.job_number ?? by.job ?? by.jobid);
      const cp_date = parseISODate(by.cp_date ?? by.completed_date ?? by.date ?? by.cpdate);

      const fc =
        asInt(by.fulfillment_center_id ?? by.fc ?? by.fc_id ?? by.fulfillmentcenterid ?? by.fulfillment_center) ?? null;

      if (!tech_id || !job_num || !cp_date) continue;

      parsed.push({
        fulfillment_center_id: fc,
        tech_id,
        job_num,
        work_order_number: asText(by.work_order_number ?? by.workorder ?? by.workorder_number),
        account: asText(by.account ?? by.customer_account ?? by.acct),
        job_type: asText(by.job_type ?? by.type ?? by.jobtype),
        job_units: asNum(by.job_units ?? by.units ?? by.unit),
        time_slot_start_time: parseTime(by.time_slot_start_time ?? by.slot_start ?? by.timeslot_start),
        time_slot_end_time: parseTime(by.time_slot_end_time ?? by.slot_end ?? by.timeslot_end),
        start_time: parseTime(by.start_time ?? by.start),
        cp_date,
        cp_time: parseTime(by.cp_time ?? by.completed_time ?? by.cp),
        // Only lookups on `by`
        job_duration: asNum(by.job_duration ?? by.duration ?? by.job_time_hours ?? by.hours),
        resolution_code: asText(by.resolution_code ?? by.resolution),
        job_comment: asText(by.job_comment ?? by.comment ?? by.comments ?? by.job_comments),
      });
    }

    const row_count_total = parsed.length;

    // FC validation: if file carries FC, it must match org expected FC
    const distinctFc = Array.from(
      new Set(parsed.map((x) => x.fulfillment_center_id).filter((x): x is number => typeof x === "number"))
    );

    if (distinctFc.length > 1) {
      return NextResponse.json<Err>(
        { ok: false, error: "multiple fulfillment centers found in file", detail: distinctFc },
        { status: 400 }
      );
    }

    const receivedFC = distinctFc[0] ?? expectedFC;
    if (receivedFC !== expectedFC) {
      return NextResponse.json<Err>(
        {
          ok: false,
          error: "fulfillment center mismatch",
          hint: "This org is guarded by pc_org.fulfillment_center_id. Upload a file for the selected org’s FC.",
          expected: expectedFC,
          received: receivedFC,
        },
        { status: 400 }
      );
    }

    if (row_count_total === 0) {
      return NextResponse.json<Err>(
        { ok: false, error: "no usable rows found", hint: "Required columns: tech_id, job_num, cp_date." },
        { status: 400 }
      );
    }

    const datesSorted = parsed.map((p) => p.cp_date).sort();
    const min_cp_date = datesSorted[0] ?? null;
    const max_cp_date = datesSorted[datesSorted.length - 1] ?? null;

    // Create batch row
    const { data: batchIns, error: batchErr } = await admin
      .from("check_in_batch")
      .insert({
        pc_org_id,
        fulfillment_center_id: expectedFC,
        uploaded_by_auth_user_id: user.id,
        source_file_name: file.name,
        source_hash: fileHash,
        row_count_total,
        row_count_loaded: 0,
        min_cp_date,
        max_cp_date,
      })
      .select("check_in_batch_id")
      .maybeSingle();

    if (batchErr || !batchIns?.check_in_batch_id) {
      return NextResponse.json<Err>(
        { ok: false, error: "failed to create batch", detail: batchErr?.message ?? batchErr },
        { status: 500 }
      );
    }

    const check_in_batch_id = batchIns.check_in_batch_id as string;

    // Upsert job rows
    const jobRows = parsed.map((p) => ({
      pc_org_id,
      check_in_batch_id,
      fulfillment_center_id: expectedFC,
      tech_id: p.tech_id,
      job_num: p.job_num,
      work_order_number: p.work_order_number,
      account: p.account,
      job_type: p.job_type,
      job_units: p.job_units,
      time_slot_start_time: p.time_slot_start_time,
      time_slot_end_time: p.time_slot_end_time,
      start_time: p.start_time,
      cp_date: p.cp_date,
      cp_time: p.cp_time,
      job_duration: p.job_duration,
      resolution_code: p.resolution_code,
      job_comment: p.job_comment,
    }));

    let loaded = 0;
    const chunkSize = 750;
    for (let i = 0; i < jobRows.length; i += chunkSize) {
      const chunk = jobRows.slice(i, i + chunkSize);
      const { error: upErr } = await admin
        .from("check_in_job_row")
        .upsert(chunk, { onConflict: "pc_org_id,job_num,cp_date,tech_id" });
      if (upErr) {
        await admin.from("check_in_batch").update({ row_count_loaded: loaded }).eq("check_in_batch_id", check_in_batch_id);
        return NextResponse.json<Err>({ ok: false, error: "failed to upsert job rows", detail: upErr.message }, { status: 500 });
      }
      loaded += chunk.length;
    }

    // Resolve fiscal_month_id via fiscal_end_date -> fiscal_month_dim
    const uniqueDates = Array.from(new Set(parsed.map((p) => p.cp_date)));
    const fiscalEndDates = Array.from(new Set(uniqueDates.map((d) => fiscalEndDateFor(d))));

    const { data: months, error: monthsErr } = await admin
      .from("fiscal_month_dim")
      .select("fiscal_month_id, fiscal_end_date")
      .in("fiscal_end_date", fiscalEndDates);

    if (monthsErr) {
      return NextResponse.json<Err>({ ok: false, error: "failed to resolve fiscal months", detail: monthsErr.message }, { status: 500 });
    }

    const monthMap = new Map<string, string>();
    for (const m of months ?? []) {
      monthMap.set(String((m as any).fiscal_end_date), String((m as any).fiscal_month_id));
    }

    for (const fe of fiscalEndDates) {
      if (!monthMap.has(fe)) {
        return NextResponse.json<Err>(
          {
            ok: false,
            error: "missing fiscal_month_dim rows",
            hint: "Ensure fiscal_month_dim contains a row for each fiscal_end_date used by Route Lock.",
            detail: { missing_fiscal_end_date: fe },
          },
          { status: 500 }
        );
      }
    }

    // Aggregate to day facts (Pattern A: upsert supports backfill)
    type Agg = {
      pc_org_id: string;
      shift_date: string;
      tech_id: string;
      fiscal_end_date: string;
      fiscal_month_id: string;
      fulfillment_center_id: number;
      actual_jobs: number;
      actual_units: number;
      actual_hours: number;
      first_start_time: string | null;
      last_cp_time: string | null;
    };

    const agg = new Map<string, Agg>();
    for (const p of parsed) {
      const key = `${pc_org_id}::${p.cp_date}::${p.tech_id}`;
      const fe = fiscalEndDateFor(p.cp_date);
      const fm = monthMap.get(fe)!;

      const cur =
        agg.get(key) ??
        ({
          pc_org_id,
          shift_date: p.cp_date,
          tech_id: p.tech_id,
          fiscal_end_date: fe,
          fiscal_month_id: fm,
          fulfillment_center_id: expectedFC,
          actual_jobs: 0,
          actual_units: 0,
          actual_hours: 0,
          first_start_time: null,
          last_cp_time: null,
        } satisfies Agg);

      cur.actual_jobs += 1;
      cur.actual_units += p.job_units ?? 0;
      cur.actual_hours += p.job_duration ?? 0;

      if (p.start_time) {
        if (!cur.first_start_time || p.start_time < cur.first_start_time) cur.first_start_time = p.start_time;
      }
      if (p.cp_time) {
        if (!cur.last_cp_time || p.cp_time > cur.last_cp_time) cur.last_cp_time = p.cp_time;
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
      const { error: dfErr } = await admin.from("check_in_day_fact").upsert(chunk, { onConflict: "pc_org_id,shift_date,tech_id" });
      if (dfErr) {
        return NextResponse.json<Err>({ ok: false, error: "failed to upsert day facts", detail: dfErr.message }, { status: 500 });
      }
    }

    await admin.from("check_in_batch").update({ row_count_loaded: loaded, min_cp_date, max_cp_date }).eq("check_in_batch_id", check_in_batch_id);

    // ✅ New rule: any sweep runs ALL sweeps
    // Check-in can touch multiple fiscal months, so sweep each fiscal_month_id touched.
    const fiscalMonthsTouched = Array.from(new Set(dayFacts.map((d) => String((d as any).fiscal_month_id))));
    const sweeps: Record<string, any> = {};

    for (const fiscal_month_id of fiscalMonthsTouched) {
      const { data: sweepRes, error: sweepErr } = await admin.rpc("route_lock_sweep_month", {
        p_pc_org_id: pc_org_id,
        p_fiscal_month_id: fiscal_month_id,
      });

      if (sweepErr) {
        return NextResponse.json<Err>(
          {
            ok: false,
            error: `check-in saved but sweep failed for fiscal_month_id=${fiscal_month_id}`,
            detail: sweepErr.message,
          },
          { status: 500 }
        );
      }

      sweeps[fiscal_month_id] = sweepRes ?? null;
    }

    return NextResponse.json<Ok>({
      ok: true,
      row_count_loaded: loaded,
      row_count_total,
      fulfillment_center_id: expectedFC,
      batch_id: check_in_batch_id,
      min_cp_date,
      max_cp_date,
      sweeps,
    });
  } catch (e: any) {
    return NextResponse.json<Err>(
      { ok: false, error: String(e?.message ?? e), detail: e?.stack ? String(e.stack) : undefined },
      { status: 500 }
    );
  }
}