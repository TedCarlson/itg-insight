import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type NotDoneDraftBody = {
  reportId?: string;
  selectedUcode?: string | null;
  customerContactAttempted?: boolean | null;
  accessIssue?: boolean | null;
  safetyIssue?: boolean | null;
  escalationRequired?: boolean | null;
  escalationType?: string | null;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: NotDoneDraftBody;

  try {
    body = (await req.json()) as NotDoneDraftBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  if (!reportId) {
    return badRequest("reportId is required.");
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_set_not_done_detail", {
    p_report_id: reportId,
    p_selected_ucode: body.selectedUcode?.trim() || null,
    p_customer_contact_attempted: body.customerContactAttempted ?? null,
    p_access_issue: body.accessIssue ?? null,
    p_safety_issue: body.safetyIssue ?? null,
    p_escalation_required: body.escalationRequired ?? null,
    p_escalation_type: body.escalationType?.trim() || null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update Not Done draft fields." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}