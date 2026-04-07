// apps/web/src/app/api/metrics/process-batch/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function json(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const batch_id = String(body?.batch_id ?? "");
    const lane = String(body?.lane ?? "NSR");

    if (!batch_id) {
      return json(400, { ok: false, error: "missing batch_id" });
    }

    if (lane !== "NSR") {
      return json(400, { ok: false, error: "only NSR supported in v1" });
    }

    const admin = supabaseAdmin();

    // 🔑 THIS is the contract
    // You will implement this function in DB next
    const { error } = await admin.rpc("metrics_run_nsr_for_batch", {
      p_batch_id: batch_id,
    });

    if (error) {
      throw new Error(error.message);
    }

    return json(200, {
      ok: true,
      batch_id,
      lane,
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: String(e?.message ?? e),
    });
  }
}