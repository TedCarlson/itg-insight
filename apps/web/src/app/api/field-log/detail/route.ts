import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const reportId = req.nextUrl.searchParams.get("reportId")?.trim();

  if (!reportId) {
    return badRequest("reportId is required.");
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_get_report_detail", {
    p_report_id: reportId,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to load Field Log report detail." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}