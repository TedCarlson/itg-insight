import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type ApproveBody = {
  reportId?: string;
  note?: string | null;
  xmLink?: string | null;
};

type FieldLogDetailLike = {
  report_id: string;
  created_by_user_id: string | null;
  status: string;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function forbidden(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

function isMissingApproveSignature(message: string) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("could not find the function public.field_log_approve_report") ||
    text.includes("function public.field_log_approve_report")
  );
}

export async function POST(req: NextRequest) {
  let body: ApproveBody;

  try {
    body = (await req.json()) as ApproveBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  const xmLink = body.xmLink?.trim() || null;
  const note = body.note?.trim() || null;

  if (!reportId) {
    return badRequest("reportId is required.");
  }

  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return forbidden("Unauthorized.");
  }

  const actingUserId = String(user.id);

  const detailRes = await supabase.rpc("field_log_get_report_detail", {
    p_report_id: reportId,
  });

  if (detailRes.error || !detailRes.data) {
    return NextResponse.json(
      {
        ok: false,
        error: detailRes.error?.message || "Failed to load Field Log report detail.",
      },
      { status: 500 }
    );
  }

  const detail = detailRes.data as FieldLogDetailLike;

  if (String(detail.created_by_user_id ?? "") === actingUserId) {
    return forbidden("Self-approval is not allowed.");
  }

  if (
    detail.status !== "pending_review" &&
    detail.status !== "sup_followup_required"
  ) {
    return badRequest("Field Log is not in an approvable state.");
  }

  if (xmLink) {
    const { error: xmError } = await supabase.rpc("field_log_append_xm_link", {
      p_report_id: reportId,
      p_action_by_user_id: actingUserId,
      p_xm_link: xmLink,
      p_note: note,
    });

    if (xmError) {
      return NextResponse.json(
        { ok: false, error: xmError.message || "Failed to append XM link." },
        { status: 500 }
      );
    }
  }

  let data: unknown = null;

  const approveWithXm = await supabase.rpc("field_log_approve_report", {
    p_report_id: reportId,
    p_action_by_user_id: actingUserId,
    p_note: note,
    p_xm_link: xmLink,
  });

  if (!approveWithXm.error) {
    data = approveWithXm.data;
    return NextResponse.json({ ok: true, data });
  }

  if (!isMissingApproveSignature(approveWithXm.error.message || "")) {
    return NextResponse.json(
      {
        ok: false,
        error: approveWithXm.error.message || "Failed to approve Field Log report.",
      },
      { status: 500 }
    );
  }

  const approveLegacy = await supabase.rpc("field_log_approve_report", {
    p_report_id: reportId,
    p_action_by_user_id: actingUserId,
    p_note: note,
  });

  if (approveLegacy.error) {
    return NextResponse.json(
      {
        ok: false,
        error: approveLegacy.error.message || "Failed to approve Field Log report.",
      },
      { status: 500 }
    );
  }

  data = approveLegacy.data;
  return NextResponse.json({ ok: true, data });
}