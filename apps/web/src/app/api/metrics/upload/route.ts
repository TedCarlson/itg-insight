// apps/web/src/app/api/metrics/upload/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import * as XLSX from "xlsx";
import crypto from "crypto";

import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { hasCapability } from "@/shared/access/access";
import { CAP } from "@/shared/access/capabilities";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function json(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function isoDateOnlyNY(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function sha256Hex(buf: Uint8Array) {
  return crypto.createHash("sha256").update(Buffer.from(buf)).digest("hex");
}

function normalizeTechId(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\s+/g, " ");
  return s ? s : null;
}

function parseGeneratedAtFromTitle(title: string | null): string | null {
  if (!title) return null;
  const m = title.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2})/);
  if (!m) return null;

  const mdY = m[1];
  const hms = m[2];

  const [mo, da, yr] = mdY.split("/").map((x) => Number(x));
  const [hh, mi, ss] = hms.split(":").map((x) => Number(x));

  if (![mo, da, yr, hh, mi, ss].every((n) => Number.isFinite(n))) return null;

  const d = new Date(yr, mo - 1, da, hh, mi, ss);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString();
}

async function resolveFiscalMonthByAnchorDate(
  supabase: any,
  anchorDateYYYYMMDD: string
): Promise<{
  fiscal_month_id: string;
  end_date: string;
  start_date: string;
  label?: string | null;
} | null> {
  const { data, error } = await supabase
    .from("fiscal_month_dim")
    .select("fiscal_month_id, start_date, end_date, label")
    .lte("start_date", anchorDateYYYYMMDD)
    .gte("end_date", anchorDateYYYYMMDD)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.end_date || !data?.start_date || !data?.fiscal_month_id) {
    return null;
  }

  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date),
    end_date: String(data.end_date),
    label: data.label ? String(data.label) : null,
  };
}

function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): any[][] {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as any[][];
}

function findFirstSheetName(workbook: XLSX.WorkBook): string | null {
  return workbook.SheetNames?.[0] ?? null;
}

function buildUniqueKey(
  techId: string,
  orgId: string,
  fiscalEndDate: string,
  batchId: string
) {
  const techNorm = techId.trim().replace(/\s+/g, " ");
  const orgNorm = orgId.toLowerCase();
  return `${techNorm}::${orgNorm}::${fiscalEndDate}::${batchId}`;
}

function dropCols2and3(headers: string[], row: any[]): Record<string, any> {
  const out: Record<string, any> = {};

  for (let i = 0; i < headers.length; i += 1) {
    const colIndex1Based = i + 1;
    if (colIndex1Based === 2 || colIndex1Based === 3) continue;

    const h = String(headers[i] ?? "").trim();
    if (!h) continue;

    out[h] = row?.[i] ?? null;
  }

  return out;
}

function toWarning(code: string, message: string, detail?: any) {
  return { code, message, ...(detail ? { detail } : {}) };
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) {
      return json(500, { ok: false, error: "missing env" });
    }

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const admin = supabaseAdmin();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    const { data: prof, error: profErr } = await supabase
      .from("user_profile")
      .select("selected_pc_org_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profErr) {
      return json(500, { ok: false, error: profErr.message });
    }

    const pc_org_id = (prof?.selected_pc_org_id as string | null) ?? null;
    if (!pc_org_id) {
      return json(400, { ok: false, error: "no org selected" });
    }

    const pass = await requireAccessPass(req, pc_org_id);
    const allowed =
      hasCapability(pass, CAP.METRICS_MANAGE) ||
      hasCapability(pass, CAP.ROSTER_MANAGE) ||
      pass.is_owner ||
      pass.is_admin;

    if (!allowed) {
      return json(403, {
        ok: false,
        error: "forbidden",
        required_any_of: ["metrics_manage", "roster_manage"],
      });
    }

    const form = await req.formData();
    const mode = String(form.get("mode") ?? "today") as "today" | "date";
    const pickedDate = form.get("picked_date")
      ? String(form.get("picked_date"))
      : null;
    const confirm = String(form.get("confirm") ?? "") === "1";
    const incomingBatchId = form.get("batch_id")
      ? String(form.get("batch_id"))
      : null;

    const file = form.get("file");
    if (!(file instanceof File)) {
      return json(400, { ok: false, error: "missing file" });
    }

    const filename = (file as any).name ? String((file as any).name) : "upload";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const file_sha256 = sha256Hex(bytes);

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

    const sheetName = findFirstSheetName(workbook);
    if (!sheetName) {
      return json(400, { ok: false, error: "no sheets found" });
    }

    const rows = sheetToRows(workbook, sheetName);
    if (!rows.length) {
      return json(400, { ok: false, error: "empty sheet" });
    }

    const title =
      rows?.[0]?.[0] !== null && rows?.[0]?.[0] !== undefined
        ? String(rows[0][0])
        : null;

    const detected_generated_at = parseGeneratedAtFromTitle(title);

    const headerRow = rows?.[1];
    if (!Array.isArray(headerRow) || headerRow.length < 2) {
      return json(400, {
        ok: false,
        error: "missing header row (expected row 2)",
      });
    }

    const headers = headerRow.map((h) => String(h ?? "").trim());
    const techIdHeaderIndex = headers.findIndex(
      (h) => h.toLowerCase() === "techid" || h.toLowerCase() === "tech id"
    );

    if (techIdHeaderIndex < 0) {
      return json(400, {
        ok: false,
        error: 'missing required column "TechId"',
      });
    }

    const metric_date = mode === "date" ? pickedDate : isoDateOnlyNY(new Date());

    if (!metric_date || !/^\d{4}-\d{2}-\d{2}$/.test(metric_date)) {
      return json(400, {
        ok: false,
        error: "invalid picked_date",
        hint: "Expected YYYY-MM-DD",
      });
    }

    const month = await resolveFiscalMonthByAnchorDate(supabase, metric_date);
    if (!month) {
      return json(400, {
        ok: false,
        error: "could not resolve fiscal month",
        hint: "No matching row in fiscal_month_dim for the selected date.",
        detail: { metric_date },
      });
    }

    const fiscal_end_date = month.end_date;
    const warning_flags: any[] = [];

    if (detected_generated_at) {
      const detectedDateNY = isoDateOnlyNY(new Date(detected_generated_at));
      const detectedMonth = await resolveFiscalMonthByAnchorDate(
        supabase,
        detectedDateNY
      ).catch(() => null);

      if (detectedMonth && detectedMonth.end_date !== fiscal_end_date) {
        warning_flags.push(
          toWarning(
            "FISCAL_MONTH_MISMATCH",
            "File generated date maps to a different fiscal month than the selected container (informational).",
            {
              selected_fiscal_end_date: fiscal_end_date,
              detected_fiscal_end_date: detectedMonth.end_date,
              detected_date: detectedDateNY,
              mode,
              metric_date,
            }
          )
        );
      }
    } else {
      warning_flags.push(
        toWarning(
          "MISSING_GENERATED_AT",
          "Could not parse a generated timestamp from row 1 title (informational)."
        )
      );
    }

    const dataRows = rows
      .slice(2)
      .filter((r) => Array.isArray(r) && r.length > 0);

    let row_count_total = 0;
    let row_count_loaded = 0;

    const normalizedTechIds: { tech_id: string; raw: Record<string, any> }[] = [];

    for (const r of dataRows) {
      const techRaw = r?.[techIdHeaderIndex] ?? null;
      const tech_id = normalizeTechId(techRaw);
      if (!tech_id) continue;

      row_count_total += 1;
      const raw = dropCols2and3(headers, r);
      normalizedTechIds.push({ tech_id, raw });
    }

    if (row_count_total === 0) {
      return json(400, {
        ok: false,
        error: "no data rows found (TechId missing/blank)",
      });
    }

    if (!confirm) {
      const { data: batch, error: batchErr } = await admin
        .from("metrics_raw_batch")
        .insert({
          pc_org_id,
          fiscal_end_date,
          metric_date,
          source_title: title,
          source_generated_at: detected_generated_at,
          source_filename: filename,
          file_sha256,
          uploaded_by: user.id,
          status: "staged",
          row_count: 0,
          warning_flags,
        })
        .select("batch_id")
        .maybeSingle();

      if (batchErr) {
        return json(500, { ok: false, error: batchErr.message });
      }

      return json(200, {
        ok: true,
        mode,
        metric_date,
        fiscal_end_date,
        detected_generated_at,
        detected_title: title,
        row_count_total,
        warning_flags,
        batch_id: batch?.batch_id ?? null,
      });
    }

    if (!incomingBatchId) {
      return json(400, { ok: false, error: "missing batch_id for confirm" });
    }

    const { data: batchRow, error: batchGetErr } = await admin
      .from("metrics_raw_batch")
      .select("batch_id, pc_org_id, fiscal_end_date, status, metric_date")
      .eq("batch_id", incomingBatchId)
      .maybeSingle();

    if (batchGetErr) {
      return json(500, { ok: false, error: batchGetErr.message });
    }

    if (!batchRow) {
      return json(400, { ok: false, error: "batch not found" });
    }

    if (String(batchRow.pc_org_id) !== String(pc_org_id)) {
      return json(403, { ok: false, error: "forbidden" });
    }

    if (String(batchRow.status) !== "staged") {
      return json(400, {
        ok: false,
        error: "batch is not staged",
        detail: { status: batchRow.status },
      });
    }

    const batch_id = String(batchRow.batch_id);
    const fiscalEndForKey = String(batchRow.fiscal_end_date);

    const toInsert = normalizedTechIds.map(({ tech_id, raw }) => {
      const unique_row_key = buildUniqueKey(
        tech_id,
        pc_org_id,
        fiscalEndForKey,
        batch_id
      );

      return {
        batch_id,
        pc_org_id,
        metric_date,
        fiscal_end_date: fiscalEndForKey,
        tech_id,
        unique_row_key,
        raw,
      };
    });

    if (toInsert.length) {
      const { error: insErr } = await admin
        .from("metrics_raw_row")
        .insert(toInsert);

      if (insErr) {
        await admin
          .from("metrics_raw_batch")
          .update({ status: "failed", error: insErr.message })
          .eq("batch_id", batch_id);

        return json(500, { ok: false, error: insErr.message });
      }

      row_count_loaded = toInsert.length;
    }

    const { error: upErr } = await admin
      .from("metrics_raw_batch")
      .update({
        status: "loaded",
        row_count: row_count_loaded,
        warning_flags,
        metric_date,
      })
      .eq("batch_id", batch_id);

    if (upErr) {
      return json(500, { ok: false, error: upErr.message });
    }

    return json(200, {
      ok: true,
      loaded: true,
      batch_id,
      metric_date,
      fiscal_end_date: fiscalEndForKey,
      row_count_loaded,
      warning_flags,
      pipeline_triggered: false,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: String(e?.message ?? e) });
  }
}