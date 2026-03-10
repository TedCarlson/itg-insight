import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type ResubmitBody = {
  reportId?: string;
  comment?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracyM?: number | null;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: ResubmitBody;

  try {
    body = (await req.json()) as ResubmitBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();

  if (!reportId) {
    return badRequest("reportId is required.");
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc(
    "field_log_resubmit_after_tech_followup",
    {
      p_report_id: reportId,
      p_comment: body.comment?.trim() || null,
      p_gps_lat: body.gpsLat ?? null,
      p_gps_lng: body.gpsLng ?? null,
      p_gps_accuracy_m: body.gpsAccuracyM ?? null,
    },
  );

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to resubmit Field Log report.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data,
  });
}