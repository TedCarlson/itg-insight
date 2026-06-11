import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import type { FieldLogDetailPayload } from "@/features/field-log/lib/fieldLogDetail.types";

export const runtime = "nodejs";

type QueueRow = {
  report_id: string;
  submitted_at: string | null;
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
  const startMs = asTime(startIso);
  const endMs = asTime(endIso);

  const supabase = await supabaseServer();

  const { data: queueRows, error: queueError } = await supabase.rpc(
    "field_log_get_review_queue",
    {
      p_pc_org_id: pcOrgId,
      p_status: "approved",
      p_category_key: "new_drop",
      p_job_number: null,
    },
  );

  if (queueError) {
    return NextResponse.json(
      { ok: false, error: queueError.message || "Failed to load New Drop report rows." },
      { status: 500 },
    );
  }

  const rows = ((queueRows ?? []) as QueueRow[]).filter((row) => {
    const t = asTime(row.submitted_at);
    return t >= startMs && t <= endMs;
  });

  const details: FieldLogDetailPayload[] = [];

  for (const row of rows) {
    const { data, error } = await supabase.rpc("field_log_get_report_detail", {
      p_report_id: row.report_id,
    });

    if (!error && data) {
      details.push(data as FieldLogDetailPayload);
    }
  }

  details.sort((a, b) => {
    const aTime = asTime(a.submitted_at ?? a.created_at);
    const bTime = asTime(b.submitted_at ?? b.created_at);
    return aTime - bTime;
  });

  return NextResponse.json({
    ok: true,
    data: details,
    meta: { start, end, category_key: "new_drop", status: "approved" },
  });
}
