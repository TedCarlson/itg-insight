import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell, PageHeader } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

import { supabaseServer } from "@/shared/data/supabase/server";
import { requireSelectedPcOrgServer } from "@/shared/lib/auth/requireSelectedPcOrg.server";

import { todayInNY, weekdayKey } from "@/features/route-lock/calendar/lib/fiscalMonth";
import { ScheduleGridClient } from "@/features/route-lock/schedule/ScheduleGridClient";
import { SeedNextMonthButton } from "@/features/route-lock/schedule/SeedNextMonthButton";

type FiscalMonth = {
  fiscal_month_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
};

type Technician = {
  assignment_id: string;
  tech_id: string;
  full_name: string;
  co_name: string | null;
};

type RouteRow = { route_id: string; route_name: string };

type ScheduleBaselineRow = {
  schedule_baseline_month_id?: string;
  assignment_id: string | null;
  tech_id: string;
  default_route_id: string | null;

  sun: boolean | null;
  mon: boolean | null;
  tue: boolean | null;
  wed: boolean | null;
  thu: boolean | null;
  fri: boolean | null;
  sat: boolean | null;
};

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

function fmtRange(fm: FiscalMonth) {
  return `${fm.start_date} → ${fm.end_date}`;
}

async function resolveFiscalMonthForDate(sb: Awaited<ReturnType<typeof supabaseServer>>, iso: string) {
  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date")
    .lte("start_date", iso)
    .gte("end_date", iso)
    .order("start_date", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const fm = (data ?? [])[0] as FiscalMonth | undefined;
  if (!fm) throw new Error(`No fiscal month found for date ${iso}`);
  return fm;
}

async function resolveNextFiscalMonth(sb: Awaited<ReturnType<typeof supabaseServer>>, current: FiscalMonth) {
  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date")
    .gt("start_date", current.end_date)
    .order("start_date", { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);
  return (data ?? [])[0] as FiscalMonth | undefined;
}

// Next 16 typed PageProps: searchParams is a Promise in generated types
export default async function SchedulePage(props: { searchParams?: Promise<{ month?: string }> }) {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) redirect("/home");

  const sp = (await props.searchParams) ?? {};
  const monthParam = String(sp.month ?? "current");

  const sb = await supabaseServer();
  const pc_org_id = scope.selected_pc_org_id;

  const today = todayInNY();
  const currentFm = await resolveFiscalMonthForDate(sb, today);
  const nextFm = await resolveNextFiscalMonth(sb, currentFm);

  const isNextView = monthParam === "next";
  const selectedBounds = isNextView ? nextFm ?? currentFm : currentFm;
  const fiscal_month_id = selectedBounds.fiscal_month_id;

  // Route-lock roster (TECHS only) — you already confirmed this trims correctly
  const { data: techs, error: techErr } = await sb
    .from("route_lock_roster_tech_v")
    .select("assignment_id,tech_id,full_name,co_name")
    .eq("pc_org_id", pc_org_id)
    .order("tech_id", { ascending: true });

  if (techErr) {
    return (
      <PageShell>
        <PageHeader title="Schedule" subtitle="Unable to load roster for this org." />
        <Card>
          <div className="text-sm text-[var(--to-ink-muted)]">Error: {techErr.message}</div>
        </Card>
      </PageShell>
    );
  }

  const technicians: Technician[] = (techs ?? []).map((t: any) => ({
    assignment_id: String(t.assignment_id),
    tech_id: String(t.tech_id ?? ""),
    full_name: String(t.full_name ?? ""),
    co_name: t.co_name == null ? null : String(t.co_name),
  }));

  // Routes
  const { data: routesData, error: routesErr } = await sb
    .from("route")
    .select("route_id,route_name")
    .eq("pc_org_id", pc_org_id)
    .order("route_name", { ascending: true });

  if (routesErr) {
    return (
      <PageShell>
        <PageHeader title="Schedule" subtitle="Unable to load routes for this org." />
        <Card>
          <div className="text-sm text-[var(--to-ink-muted)]">Error: {routesErr.message}</div>
        </Card>
      </PageShell>
    );
  }

  const routes: RouteRow[] = (routesData ?? []).map((r: any) => ({
    route_id: String(r.route_id),
    route_name: String(r.route_name ?? ""),
  }));

  // Baselines for selected month
  const { data: baselineData, error: baseErr } = await sb
    .from("schedule_baseline_month")
    .select("schedule_baseline_month_id,assignment_id,tech_id,default_route_id,sun,mon,tue,wed,thu,fri,sat,is_active")
    .eq("pc_org_id", pc_org_id)
    .eq("fiscal_month_id", fiscal_month_id)
    .eq("is_active", true);

  if (baseErr) {
    return (
      <PageShell>
        <PageHeader title="Schedule" subtitle="Unable to load baselines for this fiscal month." />
        <Card>
          <div className="text-sm text-[var(--to-ink-muted)]">Error: {baseErr.message}</div>
        </Card>
      </PageShell>
    );
  }

  // Map baselines to roster assignment_id (baseline.assignment_id should already be present)
  const scheduleByAssignment: Record<string, ScheduleBaselineRow> = {};
  for (const b of (baselineData ?? []) as any[]) {
    const assignment_id = b.assignment_id != null ? String(b.assignment_id) : null;
    if (!assignment_id) continue;
    scheduleByAssignment[assignment_id] = {
      schedule_baseline_month_id: b.schedule_baseline_month_id ? String(b.schedule_baseline_month_id) : undefined,
      assignment_id,
      tech_id: String(b.tech_id ?? ""),
      default_route_id: b.default_route_id ? String(b.default_route_id) : null,
      sun: b.sun,
      mon: b.mon,
      tue: b.tue,
      wed: b.wed,
      thu: b.thu,
      fri: b.fri,
      sat: b.sat,
    };
  }

  const baselineCount = (baselineData ?? []).length;

  // Quota weekday totals (hours) for the fiscal month (for planning strip)
  const { data: qdf, error: qErr } = await sb
    .from("quota_day_fact")
    .select("shift_date,quota_hours")
    .eq("pc_org_id", pc_org_id)
    .eq("fiscal_month_id", fiscal_month_id);

  // If quota is missing, we just don’t show the strip
  const quotaWeekdayHours: Partial<Record<DayKey, number>> | undefined = !qErr
    ? (() => {
        const acc: Partial<Record<DayKey, number>> = {};
        for (const r of qdf ?? []) {
          const k = weekdayKey(String(r.shift_date)) as DayKey;
          acc[k] = (acc[k] ?? 0) + Number(r.quota_hours ?? 0);
        }
        return acc;
      })()
    : undefined;

  const actions = (
    <div className="flex items-center gap-2">
      <Link
        href="/route-lock/schedule?month=current"
        className={`to-btn h-8 px-3 text-xs ${!isNextView ? "to-btn--primary" : "to-btn--secondary"}`}
      >
        Current
      </Link>
      <Link
        href="/route-lock/schedule?month=next"
        className={`to-btn h-8 px-3 text-xs ${isNextView ? "to-btn--primary" : "to-btn--secondary"}`}
      >
        Next
      </Link>

      {/* Manual trigger: only show when on NEXT and it’s empty */}
      {isNextView && nextFm ? (
        <SeedNextMonthButton
          fromFiscalMonthId={currentFm.fiscal_month_id}
          toFiscalMonthId={nextFm.fiscal_month_id}
          disabled={baselineCount > 0}
        />
      ) : null}
    </div>
  );

  return (
    <PageShell>
      <PageHeader
        title="Schedule"
        subtitle={`Fiscal Month: ${fmtRange(selectedBounds)} • Baselines: ${baselineCount}`}
        actions={actions}
      />

      <ScheduleGridClient
        technicians={technicians}
        routes={routes}
        scheduleByAssignment={scheduleByAssignment as any}
        fiscalMonthId={fiscal_month_id}
        defaults={{ hoursPerDay: 8, unitsPerHour: 12 }}
        quotaWeekdayHours={quotaWeekdayHours as any}
      />
    </PageShell>
  );
}