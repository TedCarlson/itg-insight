import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type QcDraftBody = {
  reportId?: string;
  qcMode?: "self_qc" | "supervisor_qc";
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: QcDraftBody;

  try {
    body = (await req.json()) as QcDraftBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  const qcMode = body.qcMode?.trim();

  if (!reportId) {
    return badRequest("reportId is required.");
  }

  if (!qcMode) {
    return badRequest("qcMode is required.");
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_set_qc_detail", {
    p_report_id: reportId,
    p_qc_mode: qcMode,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update QC draft fields." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}