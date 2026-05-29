import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { requireScheduleExceptionSubmitAccess } from "@/shared/access/scheduleExceptionSubmitAccess";
import { getRouteLockDaysForFiscalMonth } from "@/features/route-lock/calendar/lib/getRouteLockDays.server";
import {
  computeExceptionImpact,
  type DraftExceptionRow,
  type RouteLockDay,
} from "@/features/route-lock/exceptions/lib/impact";

export const runtime = "nodejs";

type ImpactPreviewBody = {
  pc_org_id?: string | null;
  rows?: Array<{
    shift_date?: string | null;
    exception_type?: string | null;
    force_off?: boolean | null;
  }> | null;
};

type FiscalMonthRow = {
  fiscal_month_id: string;
  start_date: string;
  end_date: string;
  label?: string | null;
};

function isDateOnly(v: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "").trim());
}

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

  if (profileErr) {
    return { ok: false as const, status: 500, error: profileErr.message };
  }

  const pc_org_id = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pc_org_id) {
    return { ok: false as const, status: 409, error: "no selected org" };
  }

  try {
    const pass = await requireAccessPass(req, pc_org_id);
    requireScheduleExceptionSubmitAccess(pass);
    return { ok: true as const, pc_org_id };
  } catch (err: any) {
    const status = Number(err?.status ?? 500);

    if (status === 401) return { ok: false as const, status: 401, error: "unauthorized" };
    if (status === 403) return { ok: false as const, status: 403, error: "forbidden" };
    if (status === 400) {
      return {
        ok: false as const,
        status: 400,
        error: String(err?.message ?? "invalid_pc_org_id"),
      };
    }

    return { ok: false as const, status: 500, error: "access_error" };
  }
}

async function resolveFiscalMonthForDate(sb: any, isoDate: string): Promise<FiscalMonthRow | null> {
  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .lte("start_date", isoDate)
    .gte("end_date", isoDate)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.fiscal_month_id) return null;

  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date).slice(0, 10),
    end_date: String(data.end_date).slice(0, 10),
    label: data.label ?? null,
  };
}

export async function POST(req: NextRequest) {
  const guard = await resolveSelectedPcOrg(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const body = (await req.json().catch(() => null)) as ImpactPreviewBody | null;
  const bodyPcOrgId = String(body?.pc_org_id ?? "").trim();
  const rawRows = Array.isArray(body?.rows) ? body.rows : [];

  if (!bodyPcOrgId || bodyPcOrgId !== guard.pc_org_id) {
    return NextResponse.json({ ok: false, error: "pc_org mismatch" }, { status: 403 });
  }

  if (!rawRows.length) {
    return NextResponse.json({ ok: true, rows: [] });
  }

  for (const row of rawRows) {
    if (!isDateOnly(row?.shift_date)) {
      return NextResponse.json(
        { ok: false, error: `invalid shift_date: ${String(row?.shift_date ?? "")}` },
        { status: 400 }
      );
    }
  }

  const admin = supabaseAdmin();

  const uniqueDates = Array.from(
    new Set(rawRows.map((r) => String(r?.shift_date ?? "").trim()).filter(Boolean))
  );

  const monthByDate = new Map<string, FiscalMonthRow>();
  for (const date of uniqueDates) {
    const fm = await resolveFiscalMonthForDate(admin, date);
    if (fm) monthByDate.set(date, fm);
  }

  const uniqueMonthIds = Array.from(
    new Set(Array.from(monthByDate.values()).map((m) => m.fiscal_month_id))
  );

  const allDays: RouteLockDay[] = [];

  for (const fiscalMonthId of uniqueMonthIds) {
    const res = await getRouteLockDaysForFiscalMonth(admin, guard.pc_org_id, fiscalMonthId);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
    }

    for (const raw of res.days ?? []) {
      const day = normalizeDay(raw);
      if (day) allDays.push(day);
    }
  }

  const dayByDate = new Map<string, RouteLockDay>();
  for (const day of allDays) {
    dayByDate.set(day.date, day);
  }

  const rows = rawRows.map((row) => {
    const date = String(row?.shift_date ?? "").trim();

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
      type: String(row?.exception_type ?? "MANUAL").trim() || "MANUAL",
      force_off: !!row?.force_off,
    };

    const impact = computeExceptionImpact(day, draftRow);

    return {
      shift_date: date,
      exception_type: draftRow.type,
      force_off: draftRow.force_off,
      ...impact,
    };
  });

  return NextResponse.json({ ok: true, rows });
}