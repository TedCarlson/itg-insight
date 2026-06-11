import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type DenyBody = {
  reportId?: string;
  note?: string | null;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function forbidden(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export async function POST(req: NextRequest) {
  let body: DenyBody;

  try {
    body = (await req.json()) as DenyBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  const note = body.note?.trim() || null;

  if (!reportId) return badRequest("reportId is required.");
  if (!note) return badRequest("Denial note is required.");

  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return forbidden("Unauthorized.");

  const { data, error } = await supabase.rpc("field_log_deny_report", {
    p_report_id: reportId,
    p_action_by_user_id: String(user.id),
    p_note: note,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to deny Field Log report." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}
