import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const categoryKey = req.nextUrl.searchParams.get("categoryKey");
  const jobNumber = req.nextUrl.searchParams.get("jobNumber");

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_get_review_queue", {
    p_status: status,
    p_category_key: categoryKey,
    p_job_number: jobNumber,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to load Field Log review queue." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}