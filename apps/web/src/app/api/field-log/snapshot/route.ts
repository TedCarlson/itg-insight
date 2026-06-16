import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireAccessPass } from "@/shared/access/requireAccessPass";

export const runtime = "nodejs";

function daysAgoIso(daysAgo: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const pcOrgId = req.nextUrl.searchParams.get("pc_org_id")?.trim() || null;
  const days = Math.max(
    1,
    Math.min(90, Number.parseInt(req.nextUrl.searchParams.get("days") || "30", 10) || 30),
  );

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
  const startIso = daysAgoIso(days);

  const { data, error } = await supabase
    .from("field_log_report")
    .select(`
      report_id,
      status,
      category_key,
      subcategory_key,
      submitted_at,
      updated_at,
      approved_at,
      billing_prepared_at,
      billing_email_sent_at,
      billing_email_last_error
    `)
    .eq("pc_org_id", pcOrgId)
    .not("submitted_at", "is", null)
    .or(`submitted_at.gte.${startIso},updated_at.gte.${startIso}`);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to load Field Log snapshot." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: data ?? [],
    meta: { days, start_iso: startIso },
  });
}
