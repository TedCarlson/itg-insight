import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireAccessPass } from "@/shared/access/requireAccessPass";

export const runtime = "nodejs";

const TNPS_SUBCATEGORY_KEYS = ["detractor_risk", "tnps_detractor", "tnps_passive"];

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export async function GET(req: NextRequest) {
  const pcOrgId = req.nextUrl.searchParams.get("pc_org_id")?.trim() || null;
  const query = req.nextUrl.searchParams.get("q")?.trim() || "";
  const status = req.nextUrl.searchParams.get("status")?.trim() || "";
  const categoryKey = req.nextUrl.searchParams.get("category_key")?.trim() || "";
  const view = req.nextUrl.searchParams.get("view")?.trim() || "history";
  const limit = intParam(req.nextUrl.searchParams.get("limit"), 50, 1, 100);
  const offset = intParam(req.nextUrl.searchParams.get("offset"), 0, 0, 10000);

  if (!pcOrgId) {
    return NextResponse.json({ ok: false, error: "pc_org_id is required." }, { status: 400 });
  }

  try {
    await requireAccessPass(req, pcOrgId);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Forbidden" },
      { status: err?.status || 403 },
    );
  }

  const supabase = supabaseAdmin();

  let builder = supabase
    .from("field_log_report")
    .select(
      `
      report_id,
      status,
      category_key,
      subcategory_key,
      job_number,
      job_type,
      comment,
      created_at,
      submitted_at,
      updated_at,
      approved_at,
      subject_full_name,
      subject_tech_id,
      billing_email_sent_at
    `,
      { count: "exact" },
    )
    .eq("pc_org_id", pcOrgId)
    .not("submitted_at", "is", null);

  if (status) {
    builder = builder.in(
      "status",
      status
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  if (categoryKey) {
    builder = builder.in(
      "category_key",
      categoryKey
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  if (view === "review") {
    builder = builder.in("status", [
      "pending_review",
      "tech_followup_required",
      "sup_followup_required",
    ]);
  }

  if (view === "cases") {
    builder = builder.eq("category_key", "post_call");
    builder = builder.not("subcategory_key", "in", `(${TNPS_SUBCATEGORY_KEYS.join(",")})`);
  }

  if (view === "tnps") {
    builder = builder.eq("category_key", "post_call");
    builder = builder.in("subcategory_key", TNPS_SUBCATEGORY_KEYS);
  }

  if (query) {
    const q = query.replaceAll("%", "").replaceAll(",", " ").trim();
    builder = builder.or(
      [
        `job_number.ilike.%${q}%`,
        `subject_full_name.ilike.%${q}%`,
        `subject_tech_id.ilike.%${q}%`,
        `comment.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error, count } = await builder
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to search Field Logs." },
      { status: 500 },
    );
  }

  const reportRows = data ?? [];
  const reportIds = reportRows.map((row) => row.report_id);
  const caseStatusByReportId = new Map<string, string | null>();

  if (reportIds.length > 0) {
    const { data: caseRows, error: caseError } = await supabase
      .from("field_log_report_post_call")
      .select("report_id,case_status")
      .in("report_id", reportIds);

    if (caseError) {
      return NextResponse.json(
        { ok: false, error: caseError.message || "Failed to load follow-up status." },
        { status: 500 },
      );
    }

    for (const row of caseRows ?? []) {
      caseStatusByReportId.set(row.report_id, row.case_status ?? null);
    }
  }

  const normalizedRows = reportRows.map((row) => ({
    ...row,
    tech_full_name: row.subject_full_name ?? null,
    tech_id: row.subject_tech_id ?? null,
    case_status: caseStatusByReportId.get(row.report_id) ?? null,
    evidence_badge: "",
  }));

  return NextResponse.json({
    ok: true,
    data: normalizedRows,
    meta: {
      count: count ?? 0,
      limit,
      offset,
      has_more: (count ?? 0) > offset + limit,
    },
  });
}
