import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type SubmitBody = {
  reportId?: string;
  comment?: string | null;
  evidenceDeclared?: "field_upload" | "xm_platform" | "none";
  xmDeclared?: boolean;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracyM?: number | null;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: SubmitBody;

  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  if (!reportId) {
    return badRequest("reportId is required.");
  }

  const supabase = await supabaseServer();

  const { data: validation, error: validationError } = await supabase.rpc(
    "field_log_validate_submit",
    { p_report_id: reportId },
  );

  if (validationError) {
    return NextResponse.json(
      { ok: false, error: validationError.message || "Failed to validate submission." },
      { status: 500 },
    );
  }

  const validationRow = Array.isArray(validation) ? validation[0] : validation;
  if (!validationRow?.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Submission validation failed.",
        errors: validationRow?.errors ?? [],
      },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("field_log_submit_report", {
    p_report_id: reportId,
    p_comment: body.comment?.trim() || null,
    p_evidence_declared: body.evidenceDeclared ?? "none",
    p_xm_declared: body.xmDeclared ?? false,
    p_gps_lat: body.gpsLat ?? null,
    p_gps_lng: body.gpsLng ?? null,
    p_gps_accuracy_m: body.gpsAccuracyM ?? null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to submit Field Log report." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}