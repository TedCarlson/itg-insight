import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { isTechExperienceUser } from "@/shared/access/access";

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
};

type WorkforceAffiliationRow = {
  person_id: string;
  affiliation_id: string | null;
  affiliation_code: string | null;
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

function todayYmd() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
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

  const timeScopedRows =
    startIso && endIso
      ? ((data ?? []) as QueueRow[]).filter((row) =>
          inRange(row.submitted_at ?? row.last_action_at ?? null, startIso, endIso),
        )
      : ((data ?? []) as QueueRow[]).filter((row) =>
          ["pending_review", "tech_followup_required", "sup_followup_required"].includes(row.status),
        );

  const isTechUser = isTechExperienceUser(accessPass);
  const permissions = Array.isArray(accessPass.permissions) ? accessPass.permissions : [];
  const isElevatedCompanyUser =
    accessPass.is_admin === true ||
    accessPass.is_owner === true ||
    accessPass.is_app_owner === true ||
    permissions.includes("leadership_manage") ||
    permissions.includes("permissions_manage") ||
    permissions.includes("org_console_manage") ||
    permissions.includes("admin_console_manage");

  let rows = timeScopedRows;

  if (!isElevatedCompanyUser) {
    const viewerPersonId = String(accessPass.person_id ?? "").trim();
    const personIds = Array.from(
      new Set(
        [
          viewerPersonId,
          ...timeScopedRows.map((row) => String(row.tech_person_id ?? "").trim()),
        ].filter(Boolean),
      ),
    );

    const affiliationByPersonId = new Map<string, WorkforceAffiliationRow>();

    if (personIds.length > 0) {
      const { data: workforceRows, error: workforceError } = await supabase
        .from("workforce_current_v")
        .select("person_id,affiliation_id,affiliation_code")
        .eq("pc_org_id", pcOrgId)
        .in("person_id", personIds);

      if (workforceError) {
        return NextResponse.json(
          {
            ok: false,
            error: workforceError.message || "Failed to resolve Field Log queue visibility.",
          },
          { status: 500 },
        );
      }

      for (const row of (workforceRows ?? []) as WorkforceAffiliationRow[]) {
        affiliationByPersonId.set(String(row.person_id), row);
      }
    }

    const viewerAffiliation = viewerPersonId
      ? affiliationByPersonId.get(viewerPersonId)
      : null;

    const viewerAffiliationId = String(viewerAffiliation?.affiliation_id ?? "").trim();
    const viewerAffiliationCode = String(viewerAffiliation?.affiliation_code ?? "").trim();

    if (isTechUser) {
      rows = timeScopedRows.filter((row) => {
        const createdByViewer = String(row.created_by_user_id ?? "") === accessPass.auth_user_id;
        const linkedToViewer =
          viewerPersonId.length > 0 &&
          String(row.tech_person_id ?? "") === viewerPersonId;

        return createdByViewer || linkedToViewer;
      });
    } else if (viewerAffiliationCode === "ITG") {
      rows = timeScopedRows;
    } else {
      rows = timeScopedRows.filter((row) => {
        const createdByViewer = String(row.created_by_user_id ?? "") === accessPass.auth_user_id;
        const techPersonId = String(row.tech_person_id ?? "").trim();
        const techAffiliation = techPersonId ? affiliationByPersonId.get(techPersonId) : null;
        const techAffiliationId = String(techAffiliation?.affiliation_id ?? "").trim();

        return (
          createdByViewer ||
          (viewerAffiliationId.length > 0 && techAffiliationId === viewerAffiliationId)
        );
      });
    }
  }

  return NextResponse.json({
    ok: true,
    data: rows,
    meta: {
      mode: searchMode ? "search" : day ? "day" : "open",
      start_iso: startIso,
      end_iso: endIso,
      selected_day: day,
      job_number: jobNumber,
    },
  });
}