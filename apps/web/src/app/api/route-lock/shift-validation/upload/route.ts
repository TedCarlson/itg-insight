// path: apps/web/src/app/api/route-lock/shift-validation/upload/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function json(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function todayInNY(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseFulfillmentCenter(
  summaryRowsLoose: any[]
): { id: number; name: string | null; label: string } | null {
  const flat: string[] = [];

  for (const row of summaryRowsLoose) {
    for (const v of Object.values(row ?? {})) {
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (s) flat.push(s);
    }
  }

  const line = flat.find((s) => /^Fulfillment\s*Center\s*:/i.test(s));
  if (!line) return null;

  const after = line.split(":").slice(1).join(":").trim();
  const m = after.match(/^(\d+)/);
  if (!m) return null;

  const id = Number(m[1]);
  const name = after.includes("-")
    ? after.split("-").slice(1).join("-").trim()
    : null;

  return { id, name: name || null, label: after };
}

function sheetToJson(
  workbook: XLSX.WorkBook,
  sheetName: string,
  opts?: XLSX.Sheet2JSONOpts
) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null, ...(opts ?? {}) });
}

function cleanText(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizeTechNum(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;

  if (typeof v === "number") {
    if (Number.isFinite(v) && Math.floor(v) === v) return String(v);
    return String(v);
  }

  const s = String(v).trim();
  if (!s) return null;
  if (s.endsWith(".0")) return s.slice(0, -2);
  return s;
}

function parseMMDDYYYY(raw: any): string | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);

  const s = String(raw).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

function timeStr(v: any) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(11, 19);

  if (typeof v === "number") {
    const totalSeconds = Math.round(v * 24 * 60 * 60);
    const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{1,2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s;
  return s;
}

function durationToHours(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;

  if (typeof v === "number") {
    return Number.isFinite(v) ? v * 24 : null;
  }

  const s = String(v).trim();
  if (!s) return null;

  const m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = m[3] ? Number(m[3]) : 0;
    return hh + mm / 60 + ss / 3600;
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeShiftType(v: any): string | null {
  const s = cleanText(v);
  return s ? s.toUpperCase() : null;
}

function normalizeProductivity(v: any): string | null {
  const s = cleanText(v);
  return s ? s.toUpperCase() : null;
}

function numberOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeHeaderKey(v: string) {
  return String(v)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getLoose(row: any, ...keys: string[]) {
  const wanted = new Set(keys.map(normalizeHeaderKey));

  for (const [rawKey, value] of Object.entries(row ?? {})) {
    if (wanted.has(normalizeHeaderKey(rawKey))) return value;
  }

  return null;
}

function addNullable(a: number | null, b: number | null): number | null {
  const aa = typeof a === "number" && Number.isFinite(a) ? a : 0;
  const bb = typeof b === "number" && Number.isFinite(b) ? b : 0;
  const total = aa + bb;
  return total === 0 && a === null && b === null ? null : total;
}

function normalizeExportRow(r: any) {
  const get = (...keys: string[]) => getLoose(r, ...keys);

  const tech_num = normalizeTechNum(get("Tech #"));
  const shift_date = parseMMDDYYYY(get("Shift Date"));

  const shift_type = normalizeShiftType(get("Shift Type"));
  const productivity_indicator = normalizeProductivity(get("Productivity Indicator"));

  const is_bplow = shift_type === "BPLOW" && productivity_indicator === "Y";
  const is_prjt = shift_type === "PRJT";
  const is_trvl = shift_type === "TRVL";
  const is_bptrl = shift_type === "BPTRL";

  const is_work =
    productivity_indicator === "Y" &&
    shift_type !== "BPLOW" &&
    shift_type !== "PRJT" &&
    shift_type !== "TRVL" &&
    shift_type !== "BPTRL";

  const shift_duration = durationToHours(get("Shift Duration"));
  const work_duration = durationToHours(get("Work Duration"));

  const fallbackHours = work_duration ?? shift_duration;
  const fallbackUnits =
    is_work && fallbackHours !== null && Number.isFinite(fallbackHours)
      ? fallbackHours * 12
      : null;

  return {
    fulfillment_center: null,
    company: cleanText(get("Company")),
    fsup_num: cleanText(get("FSup #")),
    fsup_last_name: cleanText(get("FSup Last Name")),
    fsup_first_name: cleanText(get("FSup First Name")),

    tech_num,
    tech_last_name: cleanText(get("Tech Last Name")),
    tech_first_name: cleanText(get("Tech First Name")),
    tech_middle_initial: cleanText(get("Tech Middle Initial")),
    title: cleanText(get("Title")),

    shift_date,
    shift_start_time: timeStr(get("Shift Start Time")),
    shift_end_time: timeStr(get("Shift End Time")),
    shift_duration,

    break_start_time: timeStr(get("Break Start Time")),
    break_end_time: timeStr(get("Break End Time")),
    break_duration: durationToHours(get("Break Duration")),

    work_duration,

    skill_groups: cleanText(get("Skill Groups")),
    route_criteria: cleanText(get("Route Criteria")),
    shift_type,
    productivity_indicator,
    start_location: cleanText(get("Start Location")),
    route_area: cleanText(get("Route Area")),
    capacity_model: cleanText(get("Capacity Model")),
    will_not_generate_capacity: cleanText(get("Will Not Generate Capacity")),
    office: cleanText(get("Office")),

    work_units:
      numberOrNull(get("Work Units")) ??
      numberOrNull(get("Work Units (12)")) ??
      fallbackUnits,

    target_unit:
      numberOrNull(get("Target Unit")) ??
      numberOrNull(get("Target Unit (12)")) ??
      fallbackUnits,

    is_work,
    is_bplow,
    is_prjt,
    is_trvl,
    is_bptrl,
  };
}

function mergeExportRows(existing: any, incoming: any) {
  return {
    ...existing,

    shift_end_time: incoming.shift_end_time ?? existing.shift_end_time,

    shift_duration: addNullable(existing.shift_duration, incoming.shift_duration),
    break_duration: addNullable(existing.break_duration, incoming.break_duration),
    work_duration: addNullable(existing.work_duration, incoming.work_duration),

    work_units: addNullable(existing.work_units, incoming.work_units),
    target_unit: addNullable(existing.target_unit, incoming.target_unit),

    skill_groups: existing.skill_groups ?? incoming.skill_groups,
    route_criteria: existing.route_criteria ?? incoming.route_criteria,
    shift_type: existing.shift_type ?? incoming.shift_type,
    productivity_indicator: existing.productivity_indicator ?? incoming.productivity_indicator,
    start_location: existing.start_location ?? incoming.start_location,
    route_area: existing.route_area ?? incoming.route_area,
    capacity_model: existing.capacity_model ?? incoming.capacity_model,
    will_not_generate_capacity:
      existing.will_not_generate_capacity ?? incoming.will_not_generate_capacity,
    office: existing.office ?? incoming.office,

    is_work: Boolean(existing.is_work || incoming.is_work),
    is_bplow: Boolean(existing.is_bplow || incoming.is_bplow),
    is_prjt: Boolean(existing.is_prjt || incoming.is_prjt),
    is_trvl: Boolean(existing.is_trvl || incoming.is_trvl),
    is_bptrl: Boolean(existing.is_bptrl || incoming.is_bptrl),
  };
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const res = NextResponse.json({ ok: true });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) return json(500, { ok: false, error: "missing env" });

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    });

    const admin = supabaseAdmin();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) return json(401, { ok: false, error: "unauthorized" });

    const { data: prof, error: profErr } = await supabase
      .from("user_profile")
      .select("selected_pc_org_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profErr) return json(500, { ok: false, error: profErr.message });

    const pc_org_id = (prof?.selected_pc_org_id as string | null) ?? null;
    if (!pc_org_id) return json(400, { ok: false, error: "no org selected" });

    const { data: isOwner } = await supabase.rpc("is_owner");

    if (!isOwner) {
      const apiClient: any = (supabase as any).schema
        ? (supabase as any).schema("api")
        : supabase;

      const { data } = await apiClient.rpc("has_pc_org_permission", {
        p_pc_org_id: pc_org_id,
        p_permission_key: "roster_manage",
      });

      if (!data) return json(403, { ok: false, error: "forbidden" });
    }

    const { data: org, error: orgErr } = await supabase
      .from("pc_org")
      .select("pc_org_id, fulfillment_center_id, fulfillment_center_name")
      .eq("pc_org_id", pc_org_id)
      .maybeSingle();

    if (orgErr) return json(500, { ok: false, error: orgErr.message });

    const expectedFc = org?.fulfillment_center_id as number | null;
    if (!expectedFc) {
      return json(400, {
        ok: false,
        error: "org fulfillment_center_id not set",
        hint: "Set public.pc_org.fulfillment_center_id for this org.",
      });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json(400, { ok: false, error: "missing file" });
    }

    const filename = (file as any).name ? String((file as any).name) : "upload";
    const bytes = new Uint8Array(await file.arrayBuffer());

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(bytes, { type: "array" });
    } catch (e: any) {
      return json(400, {
        ok: false,
        error: "failed to parse file",
        detail: String(e?.message ?? e),
      });
    }

    const summaryLoose = sheetToJson(workbook, "Summary");
    const exportData = sheetToJson(workbook, "Export");

    if (!exportData.length) {
      return json(400, { ok: false, error: 'missing "Export" data rows' });
    }

    const fc = parseFulfillmentCenter(summaryLoose);
    if (!fc) {
      return json(400, {
        ok: false,
        error: 'missing "Fulfillment Center:" line in Summary',
      });
    }

    if (Number(fc.id) !== Number(expectedFc)) {
      return json(400, {
        ok: false,
        error: "fulfillment center mismatch",
        expected: expectedFc,
        received: fc.id,
      });
    }

    const today = todayInNY();

    let minDate: string | null = null;
    let maxDate: string | null = null;

    const keyFor = (techNum: string, shiftDate: string) =>
      `${pc_org_id}|${fc.id}|${techNum}|${shiftDate}`;

    const byKey = new Map<string, any>();
    let duplicatesCollapsed = 0;
    let skippedIgnoredShiftTypes = 0;

    for (const r of exportData) {
      const n = normalizeExportRow(r);
      if (!n.tech_num || !n.shift_date) continue;

      if (n.shift_date < today) continue;

      const allowed =
        n.is_work ||
        n.is_bplow ||
        n.is_prjt ||
        n.is_trvl ||
        n.is_bptrl;

      if (!allowed) {
        skippedIgnoredShiftTypes++;
        continue;
      }

      if (!minDate || n.shift_date < minDate) minDate = n.shift_date;
      if (!maxDate || n.shift_date > maxDate) maxDate = n.shift_date;

      const k = keyFor(n.tech_num, n.shift_date);
      if (byKey.has(k)) {
        duplicatesCollapsed++;
        byKey.set(k, mergeExportRows(byKey.get(k), n));
      } else {
        byKey.set(k, {
          ...n,
          pc_org_id,
          fulfillment_center_id: fc.id,
          fulfillment_center: fc.label,
        });
      }
    }

    const rows = Array.from(byKey.values());
    const sweepStartDate = minDate ?? today;
    const sweepEndDate = maxDate ?? today;

    const { data: fiscalMonthsRaw, error: fmErr } = await supabase
      .from("fiscal_month_dim")
      .select("fiscal_month_id,start_date,end_date")
      .lte("start_date", sweepEndDate)
      .gte("end_date", sweepStartDate)
      .order("start_date", { ascending: true });

    if (fmErr) {
      return json(500, {
        ok: false,
        error: fmErr.message,
      });
    }

    const fiscalMonthIds = Array.from(
      new Set(
        (fiscalMonthsRaw ?? [])
          .map((fmRow: any) =>
            fmRow?.fiscal_month_id ? String(fmRow.fiscal_month_id) : null
          )
          .filter((v: string | null): v is string => Boolean(v))
      )
    );

    if (!fiscalMonthIds.length) {
      return json(400, {
        ok: false,
        error: "fiscal_month_dim not found for uploaded shift validation range",
        today,
        min_shift_date: minDate,
        max_shift_date: maxDate,
      });
    }

    const { error: delErr } = await supabase
      .from("shift_validation_row")
      .delete()
      .eq("pc_org_id", pc_org_id)
      .eq("fulfillment_center_id", fc.id)
      .gte("shift_date", today);

    if (delErr) return json(500, { ok: false, error: delErr.message });

    const { data: batch, error: batchErr } = await supabase
      .from("shift_validation_batch")
      .insert({
        pc_org_id,
        fulfillment_center_id: fc.id,
        fulfillment_center_name: fc.name,
        uploaded_by_auth_user_id: user.id,
        row_count_total: exportData.length,
        row_count_loaded: rows.length,
        min_shift_date: minDate,
        max_shift_date: maxDate,
      })
      .select("shift_validation_batch_id")
      .maybeSingle();

    if (batchErr) return json(500, { ok: false, error: batchErr.message });

    const batchId = batch?.shift_validation_batch_id ?? null;
    const rowsWithBatch = rows.map((r: any) => ({
      ...r,
      shift_validation_batch_id: batchId,
    }));

    if (rowsWithBatch.length) {
      const { error: insErr } = await supabase
        .from("shift_validation_row")
        .insert(rowsWithBatch);

      if (insErr) return json(500, { ok: false, error: insErr.message });
    }

    const sweepResults: Array<{
      fiscal_month_id: string;
      result: unknown;
    }> = [];

    for (const sweepFiscalMonthId of fiscalMonthIds) {
      const { data: sweepRes, error: sweepErr } = await admin.rpc(
        "route_lock_sweep_month",
        {
          p_pc_org_id: pc_org_id,
          p_fiscal_month_id: sweepFiscalMonthId,
        }
      );

      if (sweepErr) {
        return json(500, {
          ok: false,
          error: sweepErr.message,
        });
      }

      sweepResults.push({
        fiscal_month_id: sweepFiscalMonthId,
        result: sweepRes ?? null,
      });
    }

    return json(200, {
      ok: true,
      pc_org_id,
      fiscal_month_ids: fiscalMonthIds,
      fulfillment_center_id: fc.id,
      fulfillment_center_label: fc.label,
      filename,
      row_count_total: exportData.length,
      row_count_loaded: rowsWithBatch.length,
      unit_rows_loaded: rowsWithBatch.filter(
        (r: any) => r.work_units !== null || r.target_unit !== null
      ).length,
      duplicates_collapsed: duplicatesCollapsed,
      skipped_ignored_shift_types: skippedIgnoredShiftTypes,
      today,
      batch_id: batchId,
      sweep_count: fiscalMonthIds.length,
      sweep: sweepResults,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: String(e?.message ?? e) });
  }
}