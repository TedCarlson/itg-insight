import { NextRequest, NextResponse } from "next/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

const CUTOFF = "2026-07-12T04:00:00.000Z";
const TNPS_KEYS = ["detractor_risk", "tnps_detractor", "tnps_passive"];

function canManage(pass: any) {
  if (pass?.is_admin || pass?.is_app_owner || pass?.is_owner) return true;
  const values = [pass?.role, pass?.role_key, ...(Array.isArray(pass?.permissions) ? pass.permissions : [])]
    .filter(Boolean).map((value) => String(value).toLowerCase());
  return values.some((value) => value.includes("manager") || value.includes("director") || value.includes("field_log_manage") || value === "vp");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pcOrgId = String(body?.pcOrgId ?? "").trim();
    const execute = body?.execute === true;
    const pass = await requireAccessPass(req, pcOrgId);
    if (!canManage(pass)) return NextResponse.json({ ok: false, error: "Manager access is required." }, { status: 403 });

    const admin = supabaseAdmin();
    const { data: reports, error } = await admin.from("field_log_report")
      .select("report_id,job_number,subject_tech_id,subject_full_name,submitted_at")
      .eq("pc_org_id", pcOrgId).eq("category_key", "post_call")
      .in("subcategory_key", TNPS_KEYS).lt("submitted_at", CUTOFF).order("submitted_at");
    if (error) throw new Error(error.message);
    const ids = (reports ?? []).map((row) => row.report_id);
    if (ids.length === 0) return NextResponse.json({ ok: true, data: { count: 0, records: [], executed: false } });

    const { data: active, error: activeError } = await admin.from("field_log_report_post_call")
      .select("report_id,case_status").in("report_id", ids).not("case_status", "in", "(closed,resolved)");
    if (activeError) throw new Error(activeError.message);
    const activeIds = (active ?? []).map((row) => row.report_id);
    const priorStatus = new Map((active ?? []).map((row) => [row.report_id, row.case_status]));
    const records = (reports ?? []).filter((row) => activeIds.includes(row.report_id));
    if (!execute || activeIds.length === 0) return NextResponse.json({ ok: true, data: { count: records.length, records, executed: false } });

    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const { error: closeError } = await admin.from("field_log_report_post_call").update({ case_status: "closed", closed_at: now }).in("report_id", activeIds);
    if (closeError) throw new Error(closeError.message);
    await admin.from("field_log_report").update({ updated_at: now }).in("report_id", activeIds);
    const { error: eventError } = await admin.from("field_log_event").insert(activeIds.map((reportId) => ({
      report_id: reportId, event_type: "status_changed", from_status: priorStatus.get(reportId) ?? "open", to_status: "closed",
      actor_user_id: user?.id ?? null, note: "Initial tNPS email program cutoff: cases submitted before July 12, 2026 closed prior to first digest.",
      meta: { bucket: "workflow", source: "tnps_email_initial_cutoff", cutoff: CUTOFF },
    })));
    if (eventError) throw new Error(eventError.message);
    return NextResponse.json({ ok: true, data: { count: records.length, records, executed: true } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Cutoff operation failed." }, { status: 500 });
  }
}
