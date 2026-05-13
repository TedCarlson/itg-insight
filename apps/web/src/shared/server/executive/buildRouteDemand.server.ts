// path: apps/web/src/shared/server/executive/buildRouteDemand.server.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import {
  getRouteLockDaysForCurrentFiscalMonth,
  type CalendarDayRow,
} from "@/features/route-lock/calendar/lib/getRouteLockDays.server";

export type ExecutiveRouteDemandScopeRow = {
  assignment_id: string | null;
  pc_org_id: string | null;
};

export type ExecutiveRouteDemandOrgRow = {
  pc_org_id: string;
  org_label: string;

  today_demand_routes: number;
  today_scheduled_techs: number;
  today_gap: number | null;

  next_7_demand_routes: number;
  next_7_scheduled_tech_days: number;
  next_7_gap: number | null;
};

export type ExecutiveRouteDemandPayload = {
  today_iso: string;
  window_start: string;
  window_end: string;

  today_demand_routes: number;
  today_scheduled_techs: number;
  today_gap: number | null;

  next_7_demand_routes: number;
  next_7_scheduled_tech_days: number;
  next_7_gap: number | null;

  rows_by_org: ExecutiveRouteDemandOrgRow[];
};

type BuildRouteDemandArgs = {
  coveredOrgIds: string[];
  orgLabels: Map<string, string>;
  scopedAssignments: ExecutiveRouteDemandScopeRow[];
};

type ScheduleFactRow = {
  pc_org_id: string | null;
  assignment_id: string | null;
  shift_date: string | null;
};

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function n(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function nullableGap(scheduled: number, demand: number) {
  if (demand <= 0) return null;
  return scheduled - demand;
}

function sumDemand(days: CalendarDayRow[]) {
  return days.reduce((sum, day) => sum + n(day.quota_routes), 0);
}

async function loadRouteDemandByOrg(args: {
  coveredOrgIds: string[];
  windowStart: string;
  windowEnd: string;
}) {
  const admin = supabaseAdmin();
  const out = new Map<string, CalendarDayRow[]>();

  await Promise.all(
    args.coveredOrgIds.map(async (pcOrgId) => {
      const res = await getRouteLockDaysForCurrentFiscalMonth(admin, pcOrgId);

      if (!res.ok) {
        out.set(pcOrgId, []);
        return;
      }

      out.set(
        pcOrgId,
        res.days.filter(
          (day) => day.date >= args.windowStart && day.date <= args.windowEnd,
        ),
      );
    }),
  );

  return out;
}

async function loadScheduledTechDaysByOrg(args: {
  scopedAssignments: ExecutiveRouteDemandScopeRow[];
  windowStart: string;
  windowEnd: string;
}) {
  const assignmentIds = Array.from(
    new Set(
      args.scopedAssignments
        .map((row) => clean(row.assignment_id))
        .filter(Boolean),
    ),
  );

  const out = new Map<string, Map<string, Set<string>>>();

  if (!assignmentIds.length) return out;

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("schedule_day_fact")
    .select("pc_org_id,assignment_id,shift_date")
    .in("assignment_id", assignmentIds)
    .gte("shift_date", args.windowStart)
    .lte("shift_date", args.windowEnd);

  if (error) {
    throw new Error(
      `Executive route demand schedule lookup failed: ${error.message}`,
    );
  }

  for (const row of (data ?? []) as ScheduleFactRow[]) {
    const orgId = clean(row.pc_org_id);
    const date = clean(row.shift_date).slice(0, 10);
    const assignmentId = clean(row.assignment_id);

    if (!orgId || !date || !assignmentId) continue;

    const byDate = out.get(orgId) ?? new Map<string, Set<string>>();
    const techs = byDate.get(date) ?? new Set<string>();

    techs.add(assignmentId);
    byDate.set(date, techs);
    out.set(orgId, byDate);
  }

  return out;
}

function countScheduled(args: {
  scheduledByDate: Map<string, Set<string>> | undefined;
  start: string;
  end: string;
}) {
  if (!args.scheduledByDate) return 0;

  let total = 0;

  for (const [date, techs] of args.scheduledByDate.entries()) {
    if (date >= args.start && date <= args.end) {
      total += techs.size;
    }
  }

  return total;
}

export async function buildRouteDemand(
  args: BuildRouteDemandArgs,
): Promise<ExecutiveRouteDemandPayload> {
  const today = todayIso();
  const windowEnd = addDaysIso(today, 6);

  const [demandByOrg, scheduledByOrg] = await Promise.all([
    loadRouteDemandByOrg({
      coveredOrgIds: args.coveredOrgIds,
      windowStart: today,
      windowEnd,
    }),
    loadScheduledTechDaysByOrg({
      scopedAssignments: args.scopedAssignments,
      windowStart: today,
      windowEnd,
    }),
  ]);

  const rowsByOrg = args.coveredOrgIds
    .map((orgId) => {
      const days = demandByOrg.get(orgId) ?? [];
      const todayDays = days.filter((day) => day.date === today);

      const todayDemand = sumDemand(todayDays);
      const next7Demand = sumDemand(days);

      const scheduledByDate = scheduledByOrg.get(orgId);

      const todayScheduled = countScheduled({
        scheduledByDate,
        start: today,
        end: today,
      });

      const next7Scheduled = countScheduled({
        scheduledByDate,
        start: today,
        end: windowEnd,
      });

      return {
        pc_org_id: orgId,
        org_label: args.orgLabels.get(orgId) ?? "Org",

        today_demand_routes: todayDemand,
        today_scheduled_techs: todayScheduled,
        today_gap: nullableGap(todayScheduled, todayDemand),

        next_7_demand_routes: next7Demand,
        next_7_scheduled_tech_days: next7Scheduled,
        next_7_gap: nullableGap(next7Scheduled, next7Demand),
      };
    })
    .sort((a, b) => a.org_label.localeCompare(b.org_label));

  const todayDemandRoutes = rowsByOrg.reduce(
    (sum, row) => sum + row.today_demand_routes,
    0,
  );

  const todayScheduledTechs = rowsByOrg.reduce(
    (sum, row) => sum + row.today_scheduled_techs,
    0,
  );

  const next7DemandRoutes = rowsByOrg.reduce(
    (sum, row) => sum + row.next_7_demand_routes,
    0,
  );

  const next7ScheduledTechDays = rowsByOrg.reduce(
    (sum, row) => sum + row.next_7_scheduled_tech_days,
    0,
  );

  return {
    today_iso: today,
    window_start: today,
    window_end: windowEnd,

    today_demand_routes: todayDemandRoutes,
    today_scheduled_techs: todayScheduledTechs,
    today_gap: nullableGap(todayScheduledTechs, todayDemandRoutes),

    next_7_demand_routes: next7DemandRoutes,
    next_7_scheduled_tech_days: next7ScheduledTechDays,
    next_7_gap: nullableGap(next7ScheduledTechDays, next7DemandRoutes),

    rows_by_org: rowsByOrg,
  };
}

export default buildRouteDemand;