// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/route-lock/shift-validation/upload/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

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
  const name = after.includes("-") ? after.split("-").slice(1).join("-").trim() : null;
  return { id, name: name || null, label: after };
}

function sheetToJson(workbook: XLSX.WorkBook, sheetName: string, opts?: XLSX.Sheet2JSONOpts) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null, ...(opts ?? {}) });
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
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

function timeStr(v: any) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(11, 19);
  const s = String(v).trim();

  if (typeof v === "number") {
    const totalSeconds = Math.round(v * 24 * 60 * 60);
    const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

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

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseBreakStartEnd(v: any): { break_start_time: string | null; break_end_time: string | null } {
  if (!v) return { break_start_time: null, break_end_time: null };
  const s = String(v).trim();
  if (!s) return { break_start_time: null, break_end_time: null };

  const parts = s.split("-").map((p) => p.trim());
  if (parts.length >= 2) {
    return {
      break_start_time: timeStr(parts[0]),
      break_end_time: timeStr(parts[1]),
    };
  }
  return { break_start_time: null, break_end_time: null };
}

function normalizeSummaryRow(r: any) {
  const get = (k: string) => (k in r ? r[k] : null);

  const tech_num = normalizeTechNum(get("Tech #"));
  const shift_date = parseMMDDYYYY(get("Shift Date"));

  const { break_start_time, break_end_time } = parseBreakStartEnd(get("Break Start-End"));

  const work_units = num(get("Work Units (12)"));
  const target_unit = num(get("Target Unit (12)"));

  return {
    fulfillment_center: null,
    company: get("Company") === null ? null : String(get("Company")).trim(),
    fsup_num: get("FSup #") === null ? null : String(get("FSup #")).trim(),
    fsup_last_name: get("FSup Last Name") === null ? null : String(get("FSup Last Name")).trim(),
    fsup_first_name: get("FSup First Name") === null ? null : String(get("FSup First Name")).trim(),

    tech_num,
    tech_last_name: get("Tech Last Name") === null ? null : String(get("Tech Last Name")).trim(),
    tech_first_name: get("Tech First Name") === null ? null : String(get("Tech First Name")).trim(),
    tech_middle_initial: get("Tech Middle Initial") === null ? null : String(get("Tech Middle Initial")).trim(),
    title: get("Title") === null ? null : String(get("Title")).trim(),

    shift_date,
    shift_start_time: timeStr(get("Shift Start Time")),
    shift_end_time: timeStr(get("Shift End Time")),
    shift_duration: durationToHours(get("Shift Duration")),

    break_start_time,
    break_end_time,
    break_duration: durationToHours(get("Break Duration")),

    work_duration: durationToHours(get("Work Available for Jobs")),

    skill_groups: get("Skill Groups") === null ? null : String(get("Skill Groups")).trim(),
    route_criteria: get("Route Criteria") === null ? null : String(get("Route Criteria")).trim(),
    shift_type: null,
    productivity_indicator: null,
    start_location: get("Routing Start Location") === null ? null : String(get("Routing Start Location")).trim(),
    route_area: get("Route Areas") === null ? null : String(get("Route Areas")).trim(),
    capacity_model: get("Capacity Models") === null ? null : String(get("Capacity Models")).trim(),
    will_not_generate_capacity:
      get("Will Not Generate Capacity") === null ? null : String(get("Will Not Generate Capacity")).trim(),
    office: null,

    work_units,
    target_unit,
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

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) return json(401, { ok: false, error: "unauthorized" });

    // Require org selection
    const { data: prof, error: profErr } = await supabase
      .from("user_profile")
      .select("selected_pc_org_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profErr) return json(500, { ok: false, error: profErr.message });
    const pc_org_id = (prof?.selected_pc_org_id as string | null) ?? null;
    if (!pc_org_id) return json(400, { ok: false, error: "no org selected" });

    // Permission: owner OR roster_manage (keep as-is for now)
    const { data: isOwner } = await supabase.rpc("is_owner");
    let hasRosterManage = false;
    if (!isOwner) {
      const apiClient: any = (supabase as any).schema ? (supabase as any).schema("api") : supabase;
      const { data } = await apiClient.rpc("has_pc_org_permission", {
        p_pc_org_id: pc_org_id,
        p_permission_key: "roster_manage",
      });
      hasRosterManage = Boolean(data);
      if (!hasRosterManage) return json(403, { ok: false, error: "forbidden" });
    }

    // Get org expected fulfillment center id
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
        hint: "Set public.pc_org.fulfillment_center_id for this org to enable upload safeguards.",
      });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json(400, { ok: false, error: "missing file" });

    const filename = (file as any).name ? String((file as any).name) : "upload";
    const bytes = new Uint8Array(await file.arrayBuffer());

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(bytes, { type: "array" });
    } catch (e: any) {
      return json(400, { ok: false, error: "failed to parse file", detail: String(e?.message ?? e) });
    }

    const summaryLoose = sheetToJson(workbook, "Summary");
    const summaryData = sheetToJson(workbook, "Summary", { range: 9 });

    if (!summaryData.length) return json(400, { ok: false, error: 'missing "Summary" data rows' });

    const fc = parseFulfillmentCenter(summaryLoose);
    if (!fc) return json(400, { ok: false, error: 'missing "Fulfillment Center:" line in Summary' });

    if (Number(fc.id) !== Number(expectedFc)) {
      return json(400, {
        ok: false,
        error: "fulfillment center mismatch",
        expected: expectedFc,
        received: fc.id,
      });
    }

    const today = todayInNY();

    // Resolve fiscal month for "today" (NY)
    const { data: fm, error: fmErr } = await supabase
      .from("fiscal_month_dim")
      .select("fiscal_month_id,start_date,end_date")
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle();

    if (fmErr) return json(500, { ok: false, error: fmErr.message });
    const fiscal_month_id = fm?.fiscal_month_id ? String(fm.fiscal_month_id) : null;
    if (!fiscal_month_id) {
      return json(400, { ok: false, error: "fiscal_month_dim not found for today", today });
    }

    let minDate: string | null = null;
    let maxDate: string | null = null;

    const keyFor = (techNum: string, shiftDate: string) => `${pc_org_id}|${fc.id}|${techNum}|${shiftDate}`;

    const byKey = new Map<string, any>();
    let duplicatesCollapsed = 0;
    let skippedTargetZero = 0;

    for (const r of summaryData) {
      const n = normalizeSummaryRow(r);
      if (!n.tech_num || !n.shift_date) continue;

      // Only ingest from today onward
      if (n.shift_date < today) continue;

      // Only ingest rows with target_unit > 0
      const tu = typeof n.target_unit === "number" ? n.target_unit : 0;
      if (!(tu > 0)) {
        skippedTargetZero++;
        continue;
      }

      if (!minDate || n.shift_date < minDate) minDate = n.shift_date;
      if (!maxDate || n.shift_date > maxDate) maxDate = n.shift_date;

      const k = keyFor(n.tech_num, n.shift_date);
      if (byKey.has(k)) duplicatesCollapsed++;

      byKey.set(k, {
        ...n,
        pc_org_id,
        fulfillment_center_id: fc.id,
        fulfillment_center: fc.label,
      });
    }

    const rows = Array.from(byKey.values());

    // Replace forward window (authoritative snapshot)
    const { error: delErr } = await supabase
      .from("shift_validation_row")
      .delete()
      .eq("pc_org_id", pc_org_id)
      .eq("fulfillment_center_id", fc.id)
      .gte("shift_date", today);

    if (delErr) return json(500, { ok: false, error: delErr.message });

    // Create batch record
    const { data: batch, error: batchErr } = await supabase
      .from("shift_validation_batch")
      .insert({
        pc_org_id,
        fulfillment_center_id: fc.id,
        fulfillment_center_name: fc.name,
        uploaded_by_auth_user_id: user.id,
        row_count_total: summaryData.length,
        row_count_loaded: rows.length,
        min_shift_date: minDate,
        max_shift_date: maxDate,
      })
      .select("shift_validation_batch_id")
      .maybeSingle();

    if (batchErr) return json(500, { ok: false, error: batchErr.message });

    const batchId = batch?.shift_validation_batch_id ?? null;
    const rowsWithBatch = rows.map((r: any) => ({ ...r, shift_validation_batch_id: batchId }));

    if (rowsWithBatch.length) {
      const { error: insErr } = await supabase.from("shift_validation_row").insert(rowsWithBatch);
      if (insErr) return json(500, { ok: false, error: insErr.message });
    }

    // ✅ New rule: any sweep runs ALL sweeps
    const { data: sweepRes, error: sweepErr } = await supabase.rpc("route_lock_sweep_month", {
      p_pc_org_id: pc_org_id,
      p_fiscal_month_id: fiscal_month_id,
    });

    if (sweepErr) return json(500, { ok: false, error: sweepErr.message });

    return json(200, {
      ok: true,
      pc_org_id,
      fiscal_month_id,
      fulfillment_center_id: fc.id,
      fulfillment_center_label: fc.label,
      filename,
      row_count_total: summaryData.length,
      row_count_loaded: rowsWithBatch.length,
      duplicates_collapsed: duplicatesCollapsed,
      skipped_target_unit_le_zero: skippedTargetZero,
      today,
      batch_id: batchId,
      sweep: sweepRes ?? null,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: String(e?.message ?? e) });
  }
}