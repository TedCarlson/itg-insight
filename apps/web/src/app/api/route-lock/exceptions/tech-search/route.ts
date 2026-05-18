// path: apps/web/src/app/api/route-lock/exceptions/tech-search/route.ts

import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { requireModule } from "@/shared/access/access";

export const runtime = "nodejs";

type GuardResult =
  | {
      ok: true;
      pc_org_id: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

type BaselineRow = {
  schedule_baseline_month_id: string | null;
  fiscal_month_id: string | null;
  assignment_id: string | null;
  tech_id: string | null;
};

type WorkforceRow = {
  assignment_id: string | null;
  person_id: string | null;
  tech_id: string | null;
  full_name: string | null;
  affiliation_code: string | null;
  affiliation: string | null;
  position_title: string | null;
  is_active: boolean | null;
};

async function resolveSelectedPcOrg(req: NextRequest): Promise<GuardResult> {
  const sb = await supabaseServer();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const admin = supabaseAdmin();

  const { data: profile, error: profileErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileErr) {
    return { ok: false, status: 500, error: profileErr.message };
  }

  const pc_org_id = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pc_org_id) {
    return { ok: false, status: 409, error: "no selected org" };
  }

  try {
    const pass = await requireAccessPass(req, pc_org_id);
    requireModule(pass, "route_lock");

    return {
      ok: true,
      pc_org_id,
    };
  } catch (err: any) {
    const status = Number(err?.status ?? 500);

    if (status === 401) {
      return { ok: false, status: 401, error: "unauthorized" };
    }

    if (status === 403) {
      return { ok: false, status: 403, error: "forbidden" };
    }

    if (status === 400) {
      return {
        ok: false,
        status: 400,
        error: String(err?.message ?? "invalid_pc_org_id"),
      };
    }

    return { ok: false, status: 500, error: "access_error" };
  }
}

function escLike(input: string) {
  return input.replace(/[%_,]/g, "");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(req: NextRequest) {
  const guard = await resolveSelectedPcOrg(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const qRaw = String(req.nextUrl.searchParams.get("q") ?? "").trim();
  const q = escLike(qRaw);
  const limit = Math.max(
    1,
    Math.min(30, Number(req.nextUrl.searchParams.get("limit") ?? 12) || 12)
  );

  const fiscalMonthIdRaw = String(req.nextUrl.searchParams.get("fiscal_month_id") ?? "").trim();
  const fiscal_month_id = fiscalMonthIdRaw && isUuid(fiscalMonthIdRaw) ? fiscalMonthIdRaw : null;

  const admin = supabaseAdmin();

  let baselineQuery = admin
    .from("schedule_baseline_month")
    .select("schedule_baseline_month_id,fiscal_month_id,assignment_id,tech_id")
    .eq("pc_org_id", guard.pc_org_id)
    .eq("is_active", true);

  if (fiscal_month_id) {
    baselineQuery = baselineQuery.eq("fiscal_month_id", fiscal_month_id);
  }

  const { data: baselineRows, error: baselineErr } = await baselineQuery;

  if (baselineErr) {
    return NextResponse.json({ ok: false, error: baselineErr.message }, { status: 500 });
  }

  const baselines = (baselineRows ?? []) as BaselineRow[];

  const assignmentIds = Array.from(
    new Set(
      baselines
        .map((row) => String(row.assignment_id ?? "").trim())
        .filter(Boolean)
    )
  );

  if (!assignmentIds.length) {
    return NextResponse.json({
      ok: true,
      items: [],
    });
  }

  let workforceQuery = admin
    .from("workforce_current_v")
    .select(
      "assignment_id,person_id,tech_id,full_name,affiliation_code,affiliation,position_title,is_active"
    )
    .eq("pc_org_id", guard.pc_org_id)
    .eq("is_active", true)
    .in("assignment_id", assignmentIds)
    .not("person_id", "is", null)
    .not("tech_id", "is", null)
    .limit(limit);

  if (q) {
    workforceQuery = workforceQuery.or(`full_name.ilike.%${q}%,tech_id.ilike.%${q}%`);
  }

  const { data: workforceRows, error: workforceErr } = await workforceQuery.order("full_name", {
    ascending: true,
  });

  if (workforceErr) {
    return NextResponse.json({ ok: false, error: workforceErr.message }, { status: 500 });
  }

  const baselineByAssignmentId = new Map<string, BaselineRow>();

  for (const row of baselines) {
    const assignmentId = String(row.assignment_id ?? "").trim();
    if (!assignmentId || baselineByAssignmentId.has(assignmentId)) continue;
    baselineByAssignmentId.set(assignmentId, row);
  }

  const seen = new Set<string>();

  const items = ((workforceRows ?? []) as WorkforceRow[])
    .map((row) => {
      const assignment_id = String(row.assignment_id ?? "").trim();
      const baseline = baselineByAssignmentId.get(assignment_id);

      return {
        assignment_id,
        person_id: String(row.person_id ?? "").trim(),
        tech_id: String(row.tech_id ?? "").trim(),
        full_name: String(row.full_name ?? "").trim(),
        co_name:
          row.affiliation_code == null && row.affiliation == null
            ? null
            : String(row.affiliation_code ?? row.affiliation),
        affiliation_code: row.affiliation_code == null ? null : String(row.affiliation_code),
        affiliation: row.affiliation == null ? null : String(row.affiliation),
        position_title: row.position_title == null ? null : String(row.position_title),
        schedule_baseline_month_id:
          baseline?.schedule_baseline_month_id == null
            ? null
            : String(baseline.schedule_baseline_month_id),
        fiscal_month_id: baseline?.fiscal_month_id == null ? null : String(baseline.fiscal_month_id),
      };
    })
    .filter((row) => row.assignment_id && row.person_id && row.tech_id && row.full_name)
    .filter((row) => {
      const key = `${row.assignment_id}::${row.person_id}::${row.tech_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return NextResponse.json({
    ok: true,
    items,
  });
}