import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type ApproveBody = {
  reportId?: string;
  actionByUserId?: string;
  note?: string | null;
  xmLink?: string | null;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: ApproveBody;

  try {
    body = (await req.json()) as ApproveBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  const actionByUserId = body.actionByUserId?.trim();
  const xmLink = body.xmLink?.trim() || null;
  const note = body.note?.trim() || null;

  if (!reportId) {
    return badRequest("reportId is required.");
  }

  if (!actionByUserId) {
    return badRequest("actionByUserId is required.");
  }

  const supabase = await supabaseServer();

  /**
   * STEP 1 — Persist XM link (audit trail)
   * This remains important for lifecycle + timeline
   */
  if (xmLink) {
    const { error: xmError } = await supabase.rpc("field_log_append_xm_link", {
      p_report_id: reportId,
      p_action_by_user_id: actionByUserId,
      p_xm_link: xmLink,
      p_note: note,
    });

    if (xmError) {
      return NextResponse.json(
        { ok: false, error: xmError.message || "Failed to append XM link." },
        { status: 500 },
      );
    }
  }

  /**
   * STEP 2 — Approve WITH XM context
   *
   * 🔥 CRITICAL FIX:
   * Pass xmLink into approval RPC so validation logic can treat it
   * as an alternate evidence satisfier (instead of requiring photos)
   */
  const { data, error } = await supabase.rpc("field_log_approve_report", {
    p_report_id: reportId,
    p_action_by_user_id: actionByUserId,
    p_note: note,
    p_xm_link: xmLink, // <-- NEW: enables override logic in DB
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error.message ||
          "Failed to approve Field Log report.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}