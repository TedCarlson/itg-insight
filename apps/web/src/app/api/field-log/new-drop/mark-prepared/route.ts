import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";

export const runtime = "nodejs";

type Body = {
  reportId?: string;
};

function json(status: number, payload: unknown) {
  return NextResponse.json(payload, { status });
}

function canPrepareBilling(accessPass: any) {
  if (!accessPass) return false;
  if (accessPass.is_admin || accessPass.is_app_owner || accessPass.is_owner) return true;

  const haystack = [
    ...(Array.isArray(accessPass.permissions) ? accessPass.permissions : []),
    ...(Array.isArray(accessPass.roles) ? accessPass.roles : []),
    accessPass.role,
    accessPass.role_key,
    accessPass.title,
    accessPass.position_title,
    accessPass.relationship_type,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return haystack.some(
    (value) =>
      value.includes("supervisor") ||
      value.includes("lead") ||
      value.includes("manager") ||
      value.includes("director") ||
      value.includes("vp") ||
      value.includes("owner") ||
      value.includes("admin"),
  );
}

export async function POST(req: NextRequest) {
  let body: Body;

  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body." });
  }

  const reportId = body.reportId?.trim();
  if (!reportId) return json(400, { ok: false, error: "reportId is required." });

  const server = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await server.auth.getUser();

  if (userError || !user) return json(401, { ok: false, error: "Unauthorized." });

  const admin = supabaseAdmin();

  const { data: report, error: reportError } = await admin
    .from("field_log_report")
    .select("report_id,pc_org_id,category_key,status,billing_prepared_at")
    .eq("report_id", reportId)
    .maybeSingle();

  if (reportError) return json(500, { ok: false, error: reportError.message });
  if (!report) return json(404, { ok: false, error: "New Drop report not found." });
  if (report.category_key !== "new_drop") {
    return json(400, { ok: false, error: "Report is not a New Drop." });
  }
  if (report.status !== "approved") {
    return json(400, { ok: false, error: "Only approved New Drops can be prepared for billing." });
  }

  let accessPass: any;
  try {
    accessPass = await requireAccessPass(req, String(report.pc_org_id));
  } catch (err: any) {
    return json(err?.status || 403, { ok: false, error: err?.message || "Forbidden." });
  }

  if (!canPrepareBilling(accessPass)) {
    return json(403, { ok: false, error: "Not allowed to prepare New Drop billing packet." });
  }

  const { data, error } = await admin
    .from("field_log_report")
    .update({
      billing_prepared_at: new Date().toISOString(),
      billing_prepared_by_user_id: user.id,
    })
    .eq("report_id", reportId)
    .select("report_id,billing_prepared_at,billing_prepared_by_user_id")
    .maybeSingle();

  if (error) return json(500, { ok: false, error: error.message });

  return json(200, { ok: true, data });
}
