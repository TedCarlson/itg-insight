import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const reportType = (url.searchParams.get("report_type") ?? "COTP").trim().toUpperCase();
  const pageIndex = Math.max(0, num(url.searchParams.get("pageIndex"), 0));
  const pageSize = Math.min(100, Math.max(5, num(url.searchParams.get("pageSize"), 25)));
  const from = pageIndex * pageSize;
  const to = from + pageSize - 1;

  const admin = supabaseAdmin();

  const { data, error, count } = await admin
    .from("locate_reporting_record")
    .select(
      "locate_reporting_record_id,report_type,report_date,week_ending_date,inferred_year,source_as_of_at,parsed_payload,summary_payload,created_by_auth_user_id,created_at,updated_at",
      { count: "exact" }
    )
    .eq("report_type", reportType)
    .order("week_ending_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((record: any) => {
    const parsed = record.parsed_payload ?? {};
    return {
      record_id: record.locate_reporting_record_id,
      report_type: record.report_type,
      report_date: record.report_date,
      week_ending_date: record.week_ending_date,
      week_ending_label: parsed.weekEnding ?? null,
      overall_performance: parsed.overallPerformance ?? null,
      state_count: Array.isArray(parsed.rows) ? parsed.rows.length : 0,
      needs_attention_count: Array.isArray(parsed.rows)
        ? parsed.rows.filter((r: any) => String(r.status).toLowerCase() === "needs attention").length
        : 0,
      watch_closely_count: Array.isArray(parsed.rows)
        ? parsed.rows.filter((r: any) => String(r.status).toLowerCase() === "watch closely").length
        : 0,
      created_by_auth_user_id: record.created_by_auth_user_id,
      source_as_of_at: record.source_as_of_at,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  });

  return NextResponse.json({
    rows,
    page: { pageIndex, pageSize, totalRows: count ?? 0 },
  });
}
