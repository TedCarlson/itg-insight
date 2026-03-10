import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type PostCallDraftBody = {
  reportId?: string;
  riskLevel?: "fyi" | "watch" | "action_needed" | null;
  tnpsRiskFlag?: boolean | null;
  followupRecommended?: boolean | null;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: PostCallDraftBody;

  try {
    body = (await req.json()) as PostCallDraftBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  if (!reportId) {
    return badRequest("reportId is required.");
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_set_post_call_detail", {
    p_report_id: reportId,
    p_risk_level: body.riskLevel ?? null,
    p_tnps_risk_flag: body.tnpsRiskFlag ?? null,
    p_followup_recommended: body.followupRecommended ?? null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update Post Call draft fields." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}