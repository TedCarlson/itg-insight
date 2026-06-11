import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import type { FieldLogDetailPayload } from "@/features/field-log/lib/fieldLogDetail.types";

export const runtime = "nodejs";

type ApprovedReportRow = {
  report_id: string;
  approved_at: string | null;
  submitted_at: string | null;
  created_at: string | null;
  subject_full_name: string | null;
  subject_tech_id: string | null;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function asTime(value: string | null | undefined) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export async function GET(req: NextRequest) {
  const pcOrgId = req.nextUrl.searchParams.get("pc_org_id")?.trim();
  const start = req.nextUrl.searchParams.get("start")?.trim();
  const end = req.nextUrl.searchParams.get("end")?.trim();

  if (!pcOrgId) return badRequest("pc_org_id is required.");
  if (!start) return badRequest("start is required.");
  if (!end) return badRequest("end is required.");

  try {
    await requireAccessPass(req, pcOrgId);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Forbidden" },
      { status: err?.status || 403 },
    );
  }

  const startIso = `${start}T00:00:00.000Z`;
  const endIso = `${end}T23:59:59.999Z`;

  const supabase = supabaseAdmin();

  const { data: approvedRows, error: approvedError } = await supabase
    .from("field_log_report")
    .select("report_id,approved_at,submitted_at,created_at,subject_full_name,subject_tech_id")
    .eq("pc_org_id", pcOrgId)
    .eq("category_key", "new_drop")
    .in("status", ["approved", "denied", "rejected"])
    .gte("approved_at", startIso)
    .lte("approved_at", endIso)
    .order("approved_at", { ascending: true });

  if (approvedError) {
    return NextResponse.json(
      { ok: false, error: approvedError.message || "Failed to load New Drop report rows." },
      { status: 500 },
    );
  }

  const rows = (approvedRows ?? []) as ApprovedReportRow[];

  const details: FieldLogDetailPayload[] = [];

  for (const row of rows) {
    const { data, error } = await supabase.rpc("field_log_get_report_detail", {
      p_report_id: row.report_id,
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to load New Drop report detail.",
          meta: {
            report_id: row.report_id,
            approved_row_count: rows.length,
          },
        },
        { status: 500 },
      );
    }

    const detail = Array.isArray(data) ? data[0] : data;

    if (!detail) {
      return NextResponse.json(
        {
          ok: false,
          error: "New Drop approved row found, but detail payload was empty.",
          meta: {
            report_id: row.report_id,
            approved_row_count: rows.length,
          },
        },
        { status: 500 },
      );
    }

    details.push({
      ...(detail as FieldLogDetailPayload),
      subject_full_name: row.subject_full_name,
      subject_tech_id: row.subject_tech_id,
    } as FieldLogDetailPayload & {
      subject_full_name: string | null;
      subject_tech_id: string | null;
    });
  }

  details.sort((a, b) => {
    const aTime = asTime(a.approved_at ?? a.submitted_at ?? a.created_at);
    const bTime = asTime(b.approved_at ?? b.submitted_at ?? b.created_at);
    return aTime - bTime;
  });

  return NextResponse.json({
    ok: true,
    data: details,
    meta: { start, end, category_key: "new_drop", status: "approved" },
  });
}
