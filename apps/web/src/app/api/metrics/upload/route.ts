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

function findFirstSheetName(workbook: XLSX.WorkBook): string | null {
  return workbook.SheetNames?.[0] ?? null;
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

function buildUniqueKey(
  techId: string,
  orgId: string,
  fiscalEndDate: string,
  batchId: string
) {
  return `${techId}::${orgId}::${fiscalEndDate}::${batchId}`;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const admin = supabaseAdmin();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    const { data: prof, error: profError } = await supabase
      .from("user_profile")
      .select("selected_pc_org_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profError) {
      return json(500, { ok: false, error: profError.message });
    }

    const pc_org_id = prof?.selected_pc_org_id ?? null;
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
      return json(403, { ok: false, error: "forbidden" });
    }

    const form = await req.formData();
    const confirm = String(form.get("confirm") ?? "") === "1";
    const incomingBatchId = form.get("batch_id")?.toString() ?? null;

    const file = form.get("file");
    if (!(file instanceof File)) {
      return json(400, { ok: false, error: "missing file" });
    }

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
      return json(400, { ok: false, error: "no sheet" });
    }

    const rows = sheetToRows(workbook, sheetName);
    if (rows.length < 2 || !Array.isArray(rows[1])) {
      return json(400, { ok: false, error: "missing header row" });
    }

    const headers = rows[1].map((h) => String(h ?? "").trim());
    const techIdx = headers.findIndex((h) => h.toLowerCase().includes("tech"));

    if (techIdx < 0) {
      return json(400, { ok: false, error: "missing tech column" });
    }

    const metric_date = isoDateOnlyNY(new Date());

    if (!confirm) {
      const { data, error } = await admin
        .from("metrics_raw_batch")
        .insert({
          pc_org_id,
          metric_date,
          fiscal_end_date: metric_date,
          source_filename: file.name,
          file_sha256,
          uploaded_by: user.id,
          status: "staged",
        })
        .select("batch_id")
        .single();

      if (error) {
        return json(500, { ok: false, error: error.message });
      }

      if (!data?.batch_id) {
        return json(500, {
          ok: false,
          error: "batch create returned no batch_id",
        });
      }

      return json(200, {
        ok: true,
        batch_id: data.batch_id,
      });
    }

    if (!incomingBatchId) {
      return json(400, { ok: false, error: "missing batch_id" });
    }

    const dataRows = rows.slice(2);

    const insertRows = dataRows
      .map((r) => {
        const tech = normalizeTechId(r?.[techIdx]);
        if (!tech) return null;

        return {
          batch_id: incomingBatchId,
          pc_org_id,
          metric_date,
          fiscal_end_date: metric_date,
          tech_id: tech,
          unique_row_key: buildUniqueKey(
            tech,
            String(pc_org_id),
            metric_date,
            incomingBatchId
          ),
          raw: r,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (insertRows.length) {
      const { error: rowInsertError } = await admin
        .from("metrics_raw_row")
        .insert(insertRows);

      if (rowInsertError) {
        return json(500, { ok: false, error: rowInsertError.message });
      }
    }

    const { error: batchUpdateError } = await admin
      .from("metrics_raw_batch")
      .update({
        status: "loaded",
        row_count: insertRows.length,
      })
      .eq("batch_id", incomingBatchId);

    if (batchUpdateError) {
      return json(500, { ok: false, error: batchUpdateError.message });
    }

    return json(200, {
      ok: true,
      loaded: true,
      batch_id: incomingBatchId,
      row_count: insertRows.length,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: String(e?.message ?? e) });
  }
}