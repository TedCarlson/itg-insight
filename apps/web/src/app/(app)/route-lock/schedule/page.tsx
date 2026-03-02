import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Toolbar } from "@/components/ui/Toolbar";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";
import { ScheduleGridClient } from "@/features/route-lock/schedule/ScheduleGridClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = { month?: string };
type Props = { searchParams?: Promise<SearchParams> };

type FiscalMonth = { fiscal_month_id: string; start_date: string; end_date: string; label: string | null };

type Technician = {
  assignment_id: string;
  tech_id: string;
  full_name: string;
  co_name: string | null;
  not_on_roster?: boolean;
};

type RouteRow = { route_id: string; route_name: string };

type ScheduleBaselineRow = {
  schedule_baseline_month_id?: string;
  assignment_id: string;
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

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function resolveFiscalMonthForDate(sb: any, anchorISO: string): Promise<FiscalMonth | null> {
  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .lte("start_date", anchorISO)
    .gte("end_date", anchorISO)
    .maybeSingle();

  if (error || !data?.fiscal_month_id) return null;
  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date),
    end_date: String(data.end_date),
    label: (data.label as string | null) ?? null,
  };
}

async function resolveNextFiscalMonth(sb: any, currentEndISO: string): Promise<FiscalMonth | null> {
  const { data, error } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .gt("start_date", currentEndISO)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.fiscal_month_id) return null;
  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date),
    end_date: String(data.end_date),
    label: (data.label as string | null) ?? null,
  };
}

// We intentionally load routes with service role (admin) because route RLS
// can be tighter than schedule planning access, and schedule must not go blank.
async function guardCanReadRouteLock(sb: any, pc_org_id: string) {
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) return { ok: false as const, status: 401, error: "unauthorized" };

  // Owner always allowed
  const { data: isOwner, error: ownerErr } = await sb.rpc("is_owner");
  if (ownerErr) return { ok: false as const, status: 403, error: "forbidden" };
  if (isOwner) return { ok: true as const };

  // Route Lock manage OR legacy roster_manage bridge
  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;
  const { data: allowed, error: permErr } = await apiClient.rpc("has_any_pc_org_permission", {
    p_pc_org_id: pc_org_id,
    p_permission_keys: ["route_lock_manage", "roster_manage"],
  });

  if (permErr || !allowed) return { ok: false as const, status: 403, error: "forbidden" };

  return { ok: true as const };
}

function MonthToggle({
  active,
  currentHref,
  nextHref,
  currentLabel,
  nextLabel,
}: {
  active: "current" | "next";
  currentHref: string;
  nextHref: string;
  currentLabel: string;
  nextLabel: string;
}) {
  return (
    <Card variant="subtle">
      <Toolbar
        left={
          <div className="min-w-0 flex items-center gap-2">
            <Link href="/route-lock" className="to-btn to-btn--secondary h-8 px-3 text-xs inline-flex items-center">
              Back
            </Link>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">Schedule</div>
              <div className="text-xs text-[var(--to-ink-muted)] truncate">
                Planning baseline • commit paints schedule_day_fact forward-only
              </div>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <Link
              href={currentHref}
              className={cls("to-btn h-8 px-3 text-xs", active === "current" ? "to-btn--primary" : "to-btn--secondary")}
            >
              Current • {currentLabel}
            </Link>
            <Link
              href={nextHref}
              className={cls("to-btn h-8 px-3 text-xs", active === "next" ? "to-btn--primary" : "to-btn--secondary")}
            >
              Next • {nextLabel}
            </Link>
          </div>
        }
      />
    </Card>
  );
}

export default async function RouteLockSchedulePage({ searchParams }: Props) {
  noStore();

  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) redirect("/home");

  const sb = await supabaseServer();
  const pc_org_id = scope.selected_pc_org_id;

  // Permission gate (read surface)
  const guard = await guardCanReadRouteLock(sb, pc_org_id);
  if (!guard.ok) {
    return (
      <PageShell>
        <Card>
          <div className="text-sm text-[var(--to-warning)]">Forbidden</div>
          <div className="text-xs text-[var(--to-ink-muted)]">{guard.error}</div>
        </Card>
      </PageShell>
    );
  }

  const today = todayInNY();
  const fmCurrent = await resolveFiscalMonthForDate(sb, today);
  if (!fmCurrent) {
    return (
      <PageShell>
        <Card>
          <div className="text-sm text-[var(--to-warning)]">Could not resolve current fiscal month (fiscal_month_dim).</div>
        </Card>
      </PageShell>
    );
  }

  const fmNext = await resolveNextFiscalMonth(sb, fmCurrent.end_date);
  if (!fmNext) {
    return (
      <PageShell>
        <Card>
          <div className="text-sm text-[var(--to-warning)]">Could not resolve next fiscal month (fiscal_month_dim).</div>
        </Card>
      </PageShell>
    );
  }

  const sp = (await searchParams) ?? {};
  const monthMode = String(sp?.month ?? "current") === "next" ? "next" : "current";
  const activeFm = monthMode === "next" ? fmNext : fmCurrent;

  const currentHref = "/route-lock/schedule?month=current";
  const nextHref = "/route-lock/schedule?month=next";

  // Routes (dropdown) — use admin to avoid route RLS blanking schedule page
  const admin = supabaseAdmin();
  const { data: routeRows, error: routesErr } = await admin
    .from("route")
    .select("route_id,route_name")
    .eq("pc_org_id", pc_org_id)
    .order("route_name", { ascending: true });

  if (routesErr) {
    return (
      <PageShell>
        <MonthToggle
          active={monthMode}
          currentHref={currentHref}
          nextHref={nextHref}
          currentLabel={String(fmCurrent.label ?? `${fmCurrent.start_date} → ${fmCurrent.end_date}`)}
          nextLabel={String(fmNext.label ?? `${fmNext.start_date} → ${fmNext.end_date}`)}
        />
        <Card>
          <div className="text-sm text-[var(--to-warning)]">Could not load routes.</div>
          <div className="text-xs text-[var(--to-ink-muted)]">{routesErr.message}</div>
        </Card>
      </PageShell>
    );
  }

  const routes = (routeRows ?? []) as RouteRow[];

  // Roster techs (DO NOT POLA-GATE schedule planning)
  const { data: rosterRows, error: rosterErr } = await sb
    .from("route_lock_roster_v")
    .select("assignment_id,tech_id,full_name,co_name,assignment_active,end_date")
    .eq("pc_org_id", pc_org_id);

  if (rosterErr) {
    return (
      <PageShell>
        <MonthToggle
          active={monthMode}
          currentHref={currentHref}
          nextHref={nextHref}
          currentLabel={String(fmCurrent.label ?? `${fmCurrent.start_date} → ${fmCurrent.end_date}`)}
          nextLabel={String(fmNext.label ?? `${fmNext.start_date} → ${fmNext.end_date}`)}
        />
        <Card>
          <div className="text-sm text-[var(--to-warning)]">{rosterErr.message}</div>
        </Card>
      </PageShell>
    );
  }

  // IMPORTANT FIX:
  // - assignments with an end_date remain "active for planning" THROUGH their end_date
  // - i.e., end_date >= today is still active
  const activeRosterTechs: Technician[] = (rosterRows ?? [])
    .map((r: any) => ({
      assignment_id: String(r?.assignment_id ?? "").trim(),
      tech_id: String(r?.tech_id ?? "").trim(),
      full_name: String(r?.full_name ?? "").trim(),
      co_name: r?.co_name == null ? null : String(r.co_name),
      assignment_active: !!r?.assignment_active,
      end_date: r?.end_date == null ? null : String(r.end_date),
    }))
    .filter((r) => r.assignment_id && r.tech_id)
    .filter((r) => {
      if (!r.assignment_active) return false;
      if (!r.end_date) return true;
      // ISO date compare works for YYYY-MM-DD
      return String(r.end_date) >= String(today);
    })
    .map(({ assignment_active: _a, end_date: _e, ...rest }) => rest);

  const rosterAssignmentIds = new Set(activeRosterTechs.map((t) => t.assignment_id));

  // Existing baselines for this fiscal month
  const { data: baselineRows, error: baselineErr } = await sb
    .from("schedule_baseline_month")
    .select("schedule_baseline_month_id,assignment_id,tech_id,default_route_id,sun,mon,tue,wed,thu,fri,sat")
    .eq("pc_org_id", pc_org_id)
    .eq("fiscal_month_id", activeFm.fiscal_month_id)
    .eq("is_active", true);

  if (baselineErr) {
    return (
      <PageShell>
        <MonthToggle
          active={monthMode}
          currentHref={currentHref}
          nextHref={nextHref}
          currentLabel={String(fmCurrent.label ?? `${fmCurrent.start_date} → ${fmCurrent.end_date}`)}
          nextLabel={String(fmNext.label ?? `${fmNext.start_date} → ${fmNext.end_date}`)}
        />
        <Card>
          <div className="text-sm text-[var(--to-warning)]">{baselineErr.message}</div>
        </Card>
      </PageShell>
    );
  }

  // Union:
  // 1) active roster techs
  // 2) baseline orphans (assignment no longer active/on-roster)
  const scheduleByAssignment: Record<string, ScheduleBaselineRow> = {};
  const orphanTechs: Technician[] = [];

  for (const r of (baselineRows ?? []) as any[]) {
    const assignment_id = String(r?.assignment_id ?? "").trim();
    const tech_id = String(r?.tech_id ?? "").trim();
    if (!assignment_id || !tech_id) continue;

    scheduleByAssignment[assignment_id] = {
      schedule_baseline_month_id: r?.schedule_baseline_month_id ? String(r.schedule_baseline_month_id) : undefined,
      assignment_id,
      tech_id,
      default_route_id: r?.default_route_id ? String(r.default_route_id) : null,
      sun: r?.sun ?? null,
      mon: r?.mon ?? null,
      tue: r?.tue ?? null,
      wed: r?.wed ?? null,
      thu: r?.thu ?? null,
      fri: r?.fri ?? null,
      sat: r?.sat ?? null,
    };

    if (!rosterAssignmentIds.has(assignment_id)) {
      orphanTechs.push({
        assignment_id,
        tech_id,
        full_name: "(Not on roster)",
        co_name: null,
        not_on_roster: true,
      });
    }
  }

  const technicians: Technician[] = [
    ...activeRosterTechs.map((t) => ({ ...t, not_on_roster: false })),
    ...orphanTechs,
  ];

  return (
    <PageShell>
      <MonthToggle
        active={monthMode}
        currentHref={currentHref}
        nextHref={nextHref}
        currentLabel={String(fmCurrent.label ?? `${fmCurrent.start_date} → ${fmCurrent.end_date}`)}
        nextLabel={String(fmNext.label ?? `${fmNext.start_date} → ${fmNext.end_date}`)}
      />

      <ScheduleGridClient
        technicians={technicians as any}
        routes={routes}
        scheduleByAssignment={scheduleByAssignment}
        fiscalMonthId={activeFm.fiscal_month_id}
        defaults={{ unitsPerHour: 12, hoursPerDay: 8 }}
      />
    </PageShell>
  );
}