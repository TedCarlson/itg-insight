import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { saveLocateReport } from "@/shared/server/locate/reporting-helper/reportingHelperService.server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const result = await saveLocateReport({
      reportType: body.report_type ?? "COTP",
      rawText: String(body.raw_text ?? ""),
      createdByAuthUserId: user.id,
    });

    return NextResponse.json({ ok: true, record_id: result.recordId, report: result.report });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Failed to save report" }, { status: 400 });
  }
}
