import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { loadLocateReportingRecord } from "@/shared/server/locate/reporting-helper/reportingHelperRepository.server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const result = await loadLocateReportingRecord(id);
    return NextResponse.json({ record: result.record, rows: result.rows, report: result.record.parsed_payload });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Report not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { supabaseAdmin } = await import("@/shared/data/supabase/admin");
  const { error } = await supabaseAdmin().from("locate_reporting_record").delete().eq("locate_reporting_record_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
