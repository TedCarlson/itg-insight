import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { requireModule } from "@/shared/access/access";
import { getRouteLockDaysForFiscalMonth } from "@/features/route-lock/calendar/lib/getRouteLockDays.server";
import {
  computeExceptionImpact,
  type DraftExceptionRow,
  type RouteLockDay,
} from "@/features/route-lock/exceptions/lib/impact";

export const runtime = "nodejs";

type FiscalMonthRow = {
  fiscal_month_id: string;
};

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeDay(raw: any): RouteLockDay | null {
  const date = String(raw?.date ?? raw?.shift_date ?? "").slice(0, 10).trim();
  if (!date) return null;

  return {
    date,
    quota_routes: numOrNull(raw?.quota_routes),
    scheduled_routes: numOrNull(raw?.scheduled_routes) ?? 0,
    delta_forecast: numOrNull(raw?.delta_forecast),
  };
}

async function resolveSelectedPcOrg(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }

  const admin = supabaseAdmin();

  const { data: profile, error: profileErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileErr) return { ok: false as const, status: 500, error: profileErr.message };

  const pc_org_id = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pc_org_id) return { ok: false as const, status: 409, error: "no selected org" };

  try {
    const pass = await requireAccessPass(req, pc_org_id);
    requireModule(pass, "route_lock");
    return { ok: true as const, pc_org_id };
  } catch (err: any) {
    const status = Number(err?.status ?? 500);
    if (status === 401) return { ok: false as const, status: 401, error: "unauthorized" };
    if (status === 403) return { ok: false as const, status: 403, error: "forbidden" };
    return { ok: false as const, status: 500, error: "access_error" };
  }
}

async function resolveFiscalMonthForDate(sb: any, isoDate: string): Promise<FiscalMonthRow | null> {
  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id")
    .lte("start_date", isoDate)
    .gte("end_date", isoDate)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.fiscal_month_id) return null;
  return { fiscal_month_id: String(data.fiscal_month_id) };
}

export async function GET(req: NextRequest) {
  const guard = await resolveSelectedPcOrg(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const from = String(req.nextUrl.searchParams.get("from") ?? "").trim();
  const to = String(req.nextUrl.searchParams.get("to") ?? "").trim();

  const admin = supabaseAdmin();

  let q = admin
    .from("schedule_exception_day")
    .select("*")
    .eq("pc_org_id", guard.pc_org_id)
    .order("shift_date", { ascending: true });

  if (from) q = q.gte("shift_date", from);
  if (to) q = q.lte("shift_date", to);

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const uniqueDates = Array.from(new Set(rows.map((r: any) => String(r.shift_date).slice(0, 10))));

  const monthIds = new Set<string>();
  for (const date of uniqueDates) {
    const fm = await resolveFiscalMonthForDate(admin, date);
    if (fm) monthIds.add(fm.fiscal_month_id);
  }

  const dayByDate = new Map<string, RouteLockDay>();

  for (const fiscalMonthId of monthIds) {
    const res = await getRouteLockDaysForFiscalMonth(admin, guard.pc_org_id, fiscalMonthId);
    if (!res.ok) continue;

    for (const raw of res.days ?? []) {
      const day = normalizeDay(raw);
      if (day) dayByDate.set(day.date, day);
    }
  }

  const enrichedRows = rows.map((row: any) => {
    const date = String(row.shift_date ?? "").slice(0, 10);

    const day =
      dayByDate.get(date) ??
      ({
        date,
        quota_routes: null,
        scheduled_routes: 0,
        delta_forecast: null,
      } satisfies RouteLockDay);

    const draftRow: DraftExceptionRow = {
      date,
      type: String(row.exception_type ?? ""),
      force_off: !!row.force_off,
    };

    const impact = computeExceptionImpact(day, draftRow);

    return {
      ...row,
      current_delta: impact.current_delta,
      projected_delta: impact.projected_delta,
      impact_change: impact.impact_change,
      impact_state: impact.state,
    };
  });

  return NextResponse.json({ ok: true, rows: enrichedRows });
}
