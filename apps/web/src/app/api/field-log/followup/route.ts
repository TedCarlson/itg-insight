import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type FollowupBody = {
  reportId?: string;
  actionByUserId?: string;
  followupType?: "tech" | "supervisor";
  note?: string | null;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: FollowupBody;

  try {
    body = (await req.json()) as FollowupBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  const actionByUserId = body.actionByUserId?.trim();
  const followupType = body.followupType?.trim();
  const note = body.note?.trim() || null;

  if (!reportId) {
    return badRequest("reportId is required.");
  }

  if (!actionByUserId) {
    return badRequest("actionByUserId is required.");
  }

  if (followupType !== "tech" && followupType !== "supervisor") {
    return badRequest("followupType must be 'tech' or 'supervisor'.");
  }

  const supabase = await supabaseServer();

  const rpcName =
    followupType === "tech"
      ? "field_log_request_tech_followup"
      : "field_log_request_sup_followup";

  const { data, error } = await supabase.rpc(rpcName, {
    p_report_id: reportId,
    p_action_by_user_id: actionByUserId,
    p_note: note,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to request follow-up." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}