import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { generateLocateReport } from "@/shared/server/locate/reporting-helper/reportingHelperService.server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const report = generateLocateReport({
      reportType: body.report_type ?? "COTP",
      rawText: String(body.raw_text ?? ""),
    });

    return NextResponse.json({ ok: true, report });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Failed to generate report" }, { status: 400 });
  }
}
