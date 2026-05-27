import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type Verdict = "pass" | "fail_supervisor_corrected" | "fail_tech_followup" | "no_action";

type FinalizeVerdictBody = {
  reportId?: string;
  verdict?: Verdict;
  note?: string | null;
  xmLink?: string | null;
};

const VERDICTS: Verdict[] = [
  "pass",
  "fail_supervisor_corrected",
  "fail_tech_followup",
  "no_action",
];

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function forbidden(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export async function POST(req: NextRequest) {
  let body: FinalizeVerdictBody;

  try {
    body = (await req.json()) as FinalizeVerdictBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  const verdict = body.verdict;
  const note = body.note?.trim() || null;
  const xmLink = body.xmLink?.trim() || null;

  if (!reportId) return badRequest("reportId is required.");
  if (!verdict || !VERDICTS.includes(verdict)) {
    return badRequest("Valid verdict is required.");
  }

  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return forbidden("Unauthorized.");
  }

  if (xmLink) {
    const { error: xmError } = await supabase.rpc("field_log_append_xm_link", {
      p_report_id: reportId,
      p_action_by_user_id: user.id,
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

  const { data, error } = await supabase.rpc("field_log_finalize_verdict", {
    p_report_id: reportId,
    p_action_by_user_id: user.id,
    p_verdict: verdict,
    p_note: note,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to finalize Field Log verdict." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}
