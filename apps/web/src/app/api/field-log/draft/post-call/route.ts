import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type PostCallDraftBody = {
  reportId?: string;
  riskLevel?: "fyi" | "watch" | "action_needed" | null;
  tnpsRiskFlag?: boolean | null;
  followupRecommended?: boolean | null;
  technicianComments?: string | null;
  customerContactFeedback?: string | null;
  lessonsTakeaways?: string | null;
  caseStatus?: "open" | "in_progress" | "pending_customer" | "resolved" | "closed" | "reopened" | null;
  caseUpdateNote?: string | null;
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

  const { data, error } = await supabase.rpc("field_log_manage_post_call_case", {
    p_report_id: reportId,
    p_case_status: body.caseStatus ?? null,
    p_note: body.caseUpdateNote ?? null,
    p_comment_type: "case_update",
    p_technician_comments: body.technicianComments ?? null,
    p_customer_contact_feedback: body.customerContactFeedback ?? null,
    p_lessons_takeaways: body.lessonsTakeaways ?? null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update Service Follow Up fields." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}