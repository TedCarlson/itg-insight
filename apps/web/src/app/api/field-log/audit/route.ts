import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import {
  FIELD_LOG_ACTIVE_STATUSES,
  applyFieldLogVisibility,
} from "@/shared/server/field-log/fieldLogVisibility.server";

export const runtime = "nodejs";

const RECENT_AUDIT_STATUSES = [
  "approved",
  "closed",
  "resolved",
  "rejected",
] as const;

type AuditRow = {
  report_id: string;
  status: string;
  category_key: string | null;
  category_label: string | null;
  subcategory_key: string | null;
  subcategory_label: string | null;
  job_number: string | null;
  job_type: string | null;
  evidence_badge?: string | null;
  submitted_at: string | null;
  last_action_at?: string | null;
  created_by_user_id?: string | null;
  tech_person_id?: string | null;
  tech_full_name?: string | null;
  tech_id?: string | null;
  approved_by_full_name?: string | null;
  last_action_type?: string | null;
};

function daysAgoIso(daysAgo: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function getAuditTime(row: AuditRow) {
  return row.last_action_at ?? row.submitted_at ?? null;
}

function isOnOrAfter(value: string | null | undefined, startIso: string) {
  if (!value) return false;

  const t = new Date(value).getTime();
  const s = new Date(startIso).getTime();

  if (Number.isNaN(t) || Number.isNaN(s)) return false;

  return t >= s;
}

async function loadRowsByStatus(args: {
  supabase: any;
  pcOrgId: string;
  status: string;
}) {
  const { supabase, pcOrgId, status } = args;

  const { data, error } = await supabase.rpc("field_log_get_review_queue", {
    p_pc_org_id: pcOrgId,
    p_status: status,
    p_category_key: null,
    p_job_number: null,
  });

  if (error) {
    throw new Error(error.message || `Failed to load ${status} Field Log audit rows.`);
  }

  return (data ?? []) as AuditRow[];
}

export async function GET(req: NextRequest) {
  const pcOrgId = req.nextUrl.searchParams.get("pc_org_id")?.trim() || null;
  const daysParam = req.nextUrl.searchParams.get("days")?.trim() || "30";
  const days = Math.max(1, Math.min(90, Number.parseInt(daysParam, 10) || 30));

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
  const recentStartIso = daysAgoIso(days);

  try {
    const [openSets, recentSets] = await Promise.all([
      Promise.all(
        FIELD_LOG_ACTIVE_STATUSES.map((status) =>
          loadRowsByStatus({ supabase, pcOrgId, status }),
        ),
      ),
      Promise.all(
        RECENT_AUDIT_STATUSES.map((status) =>
          loadRowsByStatus({ supabase, pcOrgId, status }),
        ),
      ),
    ]);

    const openRows = openSets.flat();
    const recentRows = recentSets
      .flat()
      .filter((row) => isOnOrAfter(getAuditTime(row), recentStartIso));

    const visibleOpenRows = await applyFieldLogVisibility({
      supabase,
      pcOrgId,
      accessPass,
      rows: openRows,
    });

    const visibleRecentRows = await applyFieldLogVisibility({
      supabase,
      pcOrgId,
      accessPass,
      rows: recentRows,
    });

    return NextResponse.json({
      ok: true,
      data: {
        aging_open: visibleOpenRows,
        recent_closed: visibleRecentRows,
      },
      meta: {
        days,
        recent_start_iso: recentStartIso,
        active_statuses: FIELD_LOG_ACTIVE_STATUSES,
        recent_statuses: RECENT_AUDIT_STATUSES,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to load Field Log audit.",
      },
      { status: 500 },
    );
  }
}
