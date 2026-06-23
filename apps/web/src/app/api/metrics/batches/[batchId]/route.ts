// apps/web/src/app/api/metrics/batches/[batchId]/route.ts

import { NextResponse, type NextRequest } from "next/server";

import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { hasCapability } from "@/shared/access/access";
import { CAP } from "@/shared/access/capabilities";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function json(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const metricBatchId = String(batchId ?? "").trim();

    if (!metricBatchId) {
      return json(400, { ok: false, error: "missing_batch_id" });
    }

    const admin = supabaseAdmin();

    const { data: batch, error: batchErr } = await admin
      .from("metric_raw_batches_compat_v")
      .select("batch_id, pc_org_id, fiscal_end_date, row_count, uploaded_at, status")
      .eq("batch_id", metricBatchId)
      .maybeSingle();

    if (batchErr) return json(500, { ok: false, error: batchErr.message });
    if (!batch?.pc_org_id) return json(404, { ok: false, error: "batch_not_found" });

    const pcOrgId = String(batch.pc_org_id);
    const pass = await requireAccessPass(req, pcOrgId);
    const allowed =
      hasCapability(pass, CAP.METRICS_MANAGE) ||
      hasCapability(pass, CAP.ROSTER_MANAGE) ||
      pass.is_owner ||
      pass.is_admin;

    if (!allowed) return json(403, { ok: false, error: "forbidden" });

    const { data, error } = await admin.rpc("metrics_delete_batch_exact", {
      p_metric_batch_id: metricBatchId,
      p_pc_org_id: pcOrgId,
    });

    if (error) return json(500, { ok: false, error: error.message });

    return json(200, {
      ok: true,
      deleted: true,
      batch_id: metricBatchId,
      deleted_counts: Array.isArray(data) ? data[0] : data,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: String(e?.message ?? e) });
  }
}
