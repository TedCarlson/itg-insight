// path: apps/web/src/shared/server/route-lock/check-in/checkInUploadService.server.ts

import crypto from "crypto";

import { buildCheckInRowsFromXlsx } from "./checkInUploadParser.server";
import {
  createCheckInBatch,
  loadFiscalMonthsForRange,
  loadPcOrgFulfillmentCenter,
  updateCheckInBatchLoaded,
  upsertCheckInDayFacts,
  upsertCheckInJobRows,
} from "./checkInUploadRepository.server";
import type {
  CheckInDayFactAgg,
  CheckInUploadOk,
  CheckInUploadServiceInput,
  FiscalMonthRow,
  ParsedCheckInRow,
} from "./checkInUploadTypes";

function todayInNY(): string {
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

function badRequest(message: string, extra?: Record<string, unknown>): never {
  throw Object.assign(new Error(message), {
    status: 400,
    ...(extra ?? {}),
  });
}

function serverError(message: string, extra?: Record<string, unknown>): never {
  throw Object.assign(new Error(message), {
    status: 500,
    ...(extra ?? {}),
  });
}

function resolveFiscalMonthForDate(iso: string, months: FiscalMonthRow[]): FiscalMonthRow | null {
  for (const m of months) {
    if (m.start_date <= iso && iso <= m.end_date) return m;
  }
  return null;
}

function assertFileType(filename: string) {
  const lower = filename.toLowerCase();

  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    badRequest("unsupported file type", {
      hint: "Upload the vendor Check-In XLSX/XLS report (this endpoint expects the A5 fulfillment center header).",
    });
  }
}

function validateFiscalMonthCoverage(input: {
  rows: ParsedCheckInRow[];
  months: FiscalMonthRow[];
  minCpDate: string | null;
  maxCpDate: string | null;
  todayNY: string;
}) {
  const uniqueDates = Array.from(new Set(input.rows.map((r) => r.cp_date))).sort();
  const missingDates: string[] = [];

  for (const d of uniqueDates) {
    if (!resolveFiscalMonthForDate(d, input.months)) missingDates.push(d);
  }

  if (missingDates.length) {
    serverError("failed to resolve fiscal months", {
      hint: "Some cp_date values were not covered by any fiscal_month_dim (start_date/end_date).",
      detail: {
        missing_dates: missingDates.slice(0, 100),
        min_cp_date: input.minCpDate,
        max_cp_date: input.maxCpDate,
        todayNY: input.todayNY,
        months: input.months,
      },
    });
  }
}

function buildDayFactAggs(input: {
  rows: ParsedCheckInRow[];
  pcOrgId: string;
  fulfillmentCenterId: number;
  months: FiscalMonthRow[];
}): CheckInDayFactAgg[] {
  const agg = new Map<string, CheckInDayFactAgg>();

  for (const r of input.rows) {
    const fm = resolveFiscalMonthForDate(r.cp_date, input.months);

    if (!fm) {
      serverError("failed to resolve fiscal month for check-in row", {
        detail: { cp_date: r.cp_date, tech_id: r.tech_id },
      });
    }

    const key = `${input.pcOrgId}::${r.cp_date}::${r.tech_id}`;

    const cur =
      agg.get(key) ??
      ({
        pc_org_id: input.pcOrgId,
        shift_date: r.cp_date,
        tech_id: r.tech_id,
        fiscal_month_id: fm.fiscal_month_id,
        fiscal_end_date: fm.end_date,
        fulfillment_center_id: input.fulfillmentCenterId,

        actual_jobs: 0,
        actual_units: 0,
        actual_hours: 0,

        sla_bptrl_jobs: 0,
        sla_bptrl_units: 0,
        sla_bptrl_hours: 0,

        first_start_time: null,
        last_cp_time: null,
      } satisfies CheckInDayFactAgg);

    cur.actual_jobs += 1;
    cur.actual_units += r.job_units ?? 0;
    cur.actual_hours += r.job_duration_hours ?? 0;

    if (r.is_sla_bptrl) {
      cur.sla_bptrl_jobs += 1;
      cur.sla_bptrl_units += r.job_units ?? 0;
      cur.sla_bptrl_hours += r.job_duration_hours ?? 0;
    }

    if (r.start_time) {
      if (!cur.first_start_time || r.start_time < cur.first_start_time) {
        cur.first_start_time = r.start_time;
      }
    }

    if (r.cp_time) {
      if (!cur.last_cp_time || r.cp_time > cur.last_cp_time) {
        cur.last_cp_time = r.cp_time;
      }
    }

    agg.set(key, cur);
  }

  return Array.from(agg.values());
}

export async function ingestCheckInUpload(input: CheckInUploadServiceInput): Promise<CheckInUploadOk> {
  const filename = String((input.file as any).name ?? "upload");
  assertFileType(filename);

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const buf = Buffer.from(bytes);
  const fileHash = sha256(buf);

  const expectedFC = await loadPcOrgFulfillmentCenter(input.admin, input.pcOrgId);

  if (!expectedFC) {
    badRequest("uploads disabled for this org", {
      hint: "Populate public.pc_org.fulfillment_center_id to enable.",
    });
  }

  const parsed = buildCheckInRowsFromXlsx(bytes);

  if (!parsed.sheetName) {
    badRequest("no worksheet found", {
      detail: parsed.debug,
    });
  }

  if (!parsed.fc) {
    badRequest("could not parse fulfillment center from A5", {
      hint: 'Expected cell A5 to contain: "Fulfillment Center189931101 - Keystone" (or similar).',
      expected: expectedFC,
      received: null,
      detail: parsed.debug,
    });
  }

  if (Number(parsed.fc.id) !== Number(expectedFC)) {
    badRequest("fulfillment center mismatch", {
      hint: "This org is guarded by pc_org.fulfillment_center_id. Upload a file for the selected org’s FC.",
      expected: expectedFC,
      received: parsed.fc.id,
      detail: parsed.debug,
    });
  }

  const todayNY = todayInNY();

  const allRows = parsed.rows;
  const ingestRows = allRows.filter((r) => r.cp_date < todayNY);
  const filteredOut = allRows.length - ingestRows.length;

  if (!ingestRows.length) {
    badRequest("no usable rows found (past days only)", {
      hint: "This endpoint ingests only cp_date < today (NY). Your report appears to include only today/future rows.",
      detail: {
        todayNY,
        total_rows_found: allRows.length,
        filtered_out_today_or_future: filteredOut,
        parse_debug: parsed.debug,
      },
    });
  }

  const rowCountTotal = ingestRows.length;
  const datesSorted = ingestRows.map((r) => r.cp_date).sort();
  const minCpDate = datesSorted[0] ?? null;
  const maxCpDate = datesSorted[datesSorted.length - 1] ?? null;

  if (!minCpDate || !maxCpDate) {
    badRequest("no usable date range found", {
      detail: { todayNY, rowCountTotal },
    });
  }

  const fiscalMonths = await loadFiscalMonthsForRange(input.admin, minCpDate, maxCpDate);

  if (!fiscalMonths.length) {
    serverError("failed to resolve fiscal months", {
      hint: "No fiscal_month_dim rows overlap the upload date range.",
      detail: {
        min_cp_date: minCpDate,
        max_cp_date: maxCpDate,
        todayNY,
      },
    });
  }

  validateFiscalMonthCoverage({
    rows: ingestRows,
    months: fiscalMonths,
    minCpDate,
    maxCpDate,
    todayNY,
  });

  const checkInBatchId = await createCheckInBatch(input.admin, {
    pcOrgId: input.pcOrgId,
    fulfillmentCenterId: expectedFC,
    uploadedByAuthUserId: input.uploadedByAuthUserId,
    sourceFileName: filename,
    sourceHash: fileHash,
    rowCountTotal,
    minCpDate,
    maxCpDate,
  });

  const loaded = await upsertCheckInJobRows(input.admin, {
    pcOrgId: input.pcOrgId,
    checkInBatchId,
    fulfillmentCenterId: expectedFC,
    rows: ingestRows,
  });

  const dayFacts = buildDayFactAggs({
    rows: ingestRows,
    pcOrgId: input.pcOrgId,
    fulfillmentCenterId: expectedFC,
    months: fiscalMonths,
  });

  const dayFactRows = await upsertCheckInDayFacts(input.admin, dayFacts);

  await updateCheckInBatchLoaded(input.admin, {
    checkInBatchId,
    rowCountLoaded: loaded,
    minCpDate,
    maxCpDate,
  });

  return {
    ok: true,
    row_count_loaded: loaded,
    row_count_total: rowCountTotal,
    fulfillment_center_id: expectedFC,
    batch_id: checkInBatchId,
    min_cp_date: minCpDate,
    max_cp_date: maxCpDate,
    day_fact_rows: dayFactRows,
    today_ny: todayNY,
    filtered_out_today_or_future: filteredOut,
  };
}