// path: apps/web/src/shared/server/route-lock/check-in/checkInUploadParser.server.ts

import * as XLSX from "xlsx";

import type { ParsedCheckInRow, ParsedCheckInWorkbook } from "./checkInUploadTypes";

function asText(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

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

function parseDurationHours(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;

  if (typeof v === "number" && Number.isFinite(v)) {
    return v * 24;
  }

  if (v instanceof Date && !isNaN(v.getTime())) {
    const hh = v.getUTCHours();
    const mm = v.getUTCMinutes();
    const ss = v.getUTCSeconds();
    return hh + mm / 60 + ss / 3600;
  }

  const s = String(v).trim();
  if (!s) return null;

  const m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = m[3] ? Number(m[3]) : 0;
    if (![hh, mm, ss].every((x) => Number.isFinite(x))) return null;
    return hh + mm / 60 + ss / 3600;
  }

  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function getAny(row: Record<string, unknown>, keys: string[]): unknown {
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

function sheetToJson(workbook: XLSX.WorkBook, sheetName: string, opts?: XLSX.Sheet2JSONOpts) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null, ...(opts ?? {}) });
}

function parseFulfillmentCenterFromA5(workbook: XLSX.WorkBook, sheetName: string) {
  const ws: Record<string, any> | undefined = workbook.Sheets[sheetName] as any;
  if (!ws) return null;

  const cell = ws["A5"] ?? null;
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

export function buildCheckInRowsFromXlsx(bytes: Uint8Array): ParsedCheckInWorkbook {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      sheetName: null,
      fc: null,
      rows: [],
      debug: { reason: "no_sheet" },
    };
  }

  const fc = parseFulfillmentCenterFromA5(workbook, sheetName);
  const data = sheetToJson(workbook, sheetName, { range: 9 });

  const parsed: ParsedCheckInRow[] = [];

  for (const r of data as Record<string, unknown>[]) {
    const tech = normalizeId(getAny(r, ["Tech #", "Tech#", "tech_id", "Tech ID", "Technician", "Tech"]));
    const job = normalizeId(getAny(r, ["Job #", "Job#", "job_num", "Job Number", "Job"]));
    const cpDate = parseISODate(getAny(r, ["CP Date", "Cp Date", "cp_date", "Date", "Close Date"]));

    if (!tech || !job || !cpDate) continue;

    const techLastName = asText(
      getAny(r, ["Tech Last Name", "Last Name", "Technician Last Name", "tech_last_name"])
    );

    const isSlaBptrl = techLastName !== null && techLastName.toUpperCase().includes("BPTRL");

    parsed.push({
      tech_id: tech,
      job_num: job,
      cp_date: cpDate,

      source_tech_last_name: techLastName,
      is_sla_bptrl: isSlaBptrl,

      work_order_number: asText(getAny(r, ["Work Order Number", "Work Order #", "Work Order", "work_order_number"])),
      account: asText(getAny(r, ["Account", "account"])),
      job_type: asText(getAny(r, ["Job Type", "job_type"])),
      job_units: asNum(getAny(r, ["Job Units", "Units", "job_units"])),

      time_slot_start_time: parseTime(getAny(r, ["Time Slot Start Time", "Slot Start", "time_slot_start_time"])),
      time_slot_end_time: parseTime(getAny(r, ["Time Slot End Time", "Slot End", "time_slot_end_time"])),
      start_time: parseTime(getAny(r, ["Start Time", "start_time"])),
      cp_time: parseTime(getAny(r, ["CP Time", "Cp Time", "cp_time"])),

      job_duration_hours: parseDurationHours(getAny(r, ["Job Duration", "Duration", "job_duration"])),

      resolution_code: asText(getAny(r, ["Resolution Code", "resolution_code"])),
      job_comment: asText(getAny(r, ["Job Comment", "Comments", "job_comment"])),
    });
  }

  const ws = workbook.Sheets[sheetName] as Record<string, any> | undefined;
  const a5cell = ws?.["A5"];
  const a5 = a5cell ? String(a5cell?.w ?? a5cell?.v ?? "") : null;

  return {
    sheetName,
    fc,
    rows: parsed,
    debug: {
      sheet: sheetName,
      range_start_row_1based: 10,
      row_count_scanned: data.length,
      row_count_usable: parsed.length,
      a5,
    },
  };
}