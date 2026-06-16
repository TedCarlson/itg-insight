import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import {
  FIELD_LOG_ACTIVE_STATUSES,
  applyFieldLogVisibility,
} from "@/shared/server/field-log/fieldLogVisibility.server";

export const runtime = "nodejs";

type QueueRow = {
  report_id: string;
  status: string;
  category_key: string | null;
  category_label: string | null;
  subcategory_key: string | null;
  subcategory_label: string | null;
  job_number: string | null;
  job_type: string | null;
  submitted_at: string | null;
  last_action_at?: string | null;
  created_by_user_id?: string | null;
  tech_person_id?: string | null;
  tech_office?: string | null;
  office?: string | null;
  case_status?: string | null;
};

function startOfDayIso(dateStr: string) {
  return `${dateStr}T00:00:00.000Z`;
}

function endOfDayIso(dateStr: string) {
  return `${dateStr}T23:59:59.999Z`;
}

function daysAgoIso(daysAgo: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function inRange(value: string | null | undefined, startIso: string, endIso: string) {
  if (!value) return false;

  const t = new Date(value).getTime();
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();

  if (Number.isNaN(t) || Number.isNaN(a) || Number.isNaN(b)) return false;

  return t >= a && t <= b;
}

export async function GET(req: NextRequest) {
  const pcOrgId = req.nextUrl.searchParams.get("pc_org_id")?.trim() || null;
  const status = req.nextUrl.searchParams.get("status")?.trim() || null;
  const categoryKey = req.nextUrl.searchParams.get("categoryKey")?.trim() || null;
  const jobNumber = req.nextUrl.searchParams.get("jobNumber")?.trim() || null;
  const day = req.nextUrl.searchParams.get("day")?.trim() || null;

  if (!pcOrgId) {
    return NextResponse.json(
      { ok: false, error: "pc_org_id is required." },
      { status: 400 },
    );
  }

  let accessPass;

  try {
    accessPass = await requireAccessPass(req, pcOrgId);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Forbidden" },
      { status: err?.status || 403 },
    );
  }

  const supabase = await supabaseServer();

  const searchMode = !!jobNumber;
  const hasDayFilter = !!day;

  const startIso = searchMode
    ? daysAgoIso(35)
    : hasDayFilter
      ? startOfDayIso(day)
      : null;

  const endIso = searchMode
    ? new Date().toISOString()
    : hasDayFilter
      ? endOfDayIso(day)
      : null;

  const { data, error } = await supabase.rpc("field_log_get_review_queue", {
    p_pc_org_id: pcOrgId,
    p_status: status,
    p_category_key: categoryKey,
    p_job_number: searchMode ? jobNumber : null,
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to load Field Log review queue.",
      },
      { status: 500 },
    );
  }

  const rawRows = (data ?? []) as QueueRow[];

  const timeScopedRows =
    startIso && endIso
      ? rawRows.filter((row) =>
          inRange(row.submitted_at ?? row.last_action_at ?? null, startIso, endIso),
        )
      : rawRows.filter(
          (row) =>
            FIELD_LOG_ACTIVE_STATUSES.includes(row.status as any) ||
            ((row.category_key === "new_drop" || row.category_key === "conduit_pull_install") &&
              row.status === "approved"),
        );

  let rows: QueueRow[];

  try {
    rows = await applyFieldLogVisibility({
      supabase,
      pcOrgId,
      accessPass,
      rows: timeScopedRows,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to resolve Field Log visibility.",
      },
      { status: 500 },
    );
  }

  const serviceReportIds = rows
    .filter((row) => row.category_key === "post_call")
    .map((row) => row.report_id);

  let enrichedRows = rows;

  if (serviceReportIds.length > 0) {
    const { data: caseRows, error: caseError } = await supabase
      .from("field_log_report_post_call")
      .select("report_id, case_status")
      .in("report_id", serviceReportIds);

    if (caseError) {
      return NextResponse.json(
        {
          ok: false,
          error: caseError.message || "Failed to load Service Follow Up cases.",
        },
        { status: 500 },
      );
    }

    const caseStatusByReportId = new Map(
      (caseRows ?? []).map((row) => [row.report_id, row.case_status ?? null]),
    );

    enrichedRows = rows.map((row) =>
      row.category_key === "post_call"
        ? { ...row, case_status: caseStatusByReportId.get(row.report_id) ?? "open" }
        : row,
    );
  }

  return NextResponse.json({
    ok: true,
    data: enrichedRows,
    meta: {
      mode: searchMode ? "search" : day ? "day" : "open",
      start_iso: startIso,
      end_iso: endIso,
      selected_day: day,
      job_number: jobNumber,
    },
  });
}
