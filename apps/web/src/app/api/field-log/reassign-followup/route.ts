import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type ReassignFollowupBody = {
  reportId?: string;
  followupOwnerPersonId?: string;
  note?: string | null;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function forbidden(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export async function POST(req: NextRequest) {
  let body: ReassignFollowupBody;

  try {
    body = (await req.json()) as ReassignFollowupBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  const followupOwnerPersonId = body.followupOwnerPersonId?.trim();
  const note = body.note?.trim() || null;

  if (!reportId) return badRequest("reportId is required.");
  if (!followupOwnerPersonId) return badRequest("followupOwnerPersonId is required.");

  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return forbidden("Unauthorized.");
  }

  const { data, error } = await supabase.rpc("field_log_reassign_followup", {
    p_report_id: reportId,
    p_action_by_user_id: String(user.id),
    p_followup_owner_person_id: followupOwnerPersonId,
    p_note: note,
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to reassign Field Log follow-up.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}
