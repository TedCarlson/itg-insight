import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type BaseDraftBody = {
  reportId?: string;
  jobNumber?: string | null;
  jobType?: string | null;
  comment?: string | null;
  evidenceDeclared?: "field_upload" | "xm_platform" | "none" | null;
  xmDeclared?: boolean | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracyM?: number | null;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: BaseDraftBody;

  try {
    body = (await req.json()) as BaseDraftBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  if (!reportId) {
    return badRequest("reportId is required.");
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_set_base_fields", {
    p_report_id: reportId,
    p_job_number: body.jobNumber?.trim() || null,
    p_job_type: body.jobType?.trim() || null,
    p_comment: body.comment?.trim() || null,
    p_evidence_declared: body.evidenceDeclared ?? null,
    p_xm_declared: body.xmDeclared ?? null,
    p_gps_lat: body.gpsLat ?? null,
    p_gps_lng: body.gpsLng ?? null,
    p_gps_accuracy_m: body.gpsAccuracyM ?? null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update base draft fields." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}