// path: apps/web/src/shared/server/executive/pipelines/routeLockExecutivePipeline.server.ts

import { supabaseServer } from "@/shared/data/supabase/server";
import type { ExecutiveDimensionPayload } from "@/shared/types/executive/executiveSuite";

type ScheduleFactRow = {
  assignment_id: string | null;
  shift_date: string | null;
  scheduled_hours: number | null;
};

type QuotaFactRow = {
  shift_date: string | null;
  quota_hours: number | null;
  quota_units: number | null;
};

function addDaysIso(startIso: string, days: number) {
  const date = new Date(`${startIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function n0(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function buildRouteLockExecutiveDimension(args: {
  pc_org_id: string;
  as_of_date: string;
}): Promise<ExecutiveDimensionPayload> {
  const start = args.as_of_date;
  const end = addDaysIso(start, 13);
  const sb = await supabaseServer();

  const [scheduleRes, quotaRes] = await Promise.all([
    sb
      .from("schedule_day_fact")
      .select("assignment_id,shift_date,scheduled_hours")
      .eq("pc_org_id", args.pc_org_id)
      .gte("shift_date", start)
      .lte("shift_date", end),
    sb
      .from("quota_day_fact")
      .select("shift_date,quota_hours,quota_units")
      .eq("pc_org_id", args.pc_org_id)
      .gte("shift_date", start)
      .lte("shift_date", end),
  ]);

  if (scheduleRes.error || quotaRes.error) {
    return {
      dimension: "route_lock",
      title: "Route-Lock",
      status: "degraded",
      notes: [scheduleRes.error?.message, quotaRes.error?.message].filter(Boolean) as string[],
      artifacts: [
        {
          key: "capacity_plan",
          title: "Capacity Plan",
          description: "Route-Lock fact tables are not fully readable for the executive scaffold yet.",
          status: "degraded",
          href: "/route-lock",
          cards: [],
        },
      ],
    };
  }

  const scheduleRows = (scheduleRes.data ?? []) as ScheduleFactRow[];
  const quotaRows = (quotaRes.data ?? []) as QuotaFactRow[];
  const scheduledAssignments = new Set(
    scheduleRows.map((row) => String(row.assignment_id ?? "").trim()).filter(Boolean)
  );
  const scheduledHours = scheduleRows.reduce((total, row) => total + n0(row.scheduled_hours), 0);
  const quotaHours = quotaRows.reduce((total, row) => total + n0(row.quota_hours), 0);
  const quotaUnits = quotaRows.reduce((total, row) => total + n0(row.quota_units), 0);

  return {
    dimension: "route_lock",
    title: "Route-Lock",
    status: scheduleRows.length || quotaRows.length ? "ready" : "empty",
    artifacts: [
      {
        key: "capacity_plan",
        title: "Capacity Plan",
        description: "Forward 14-day route-lock schedule and quota readiness.",
        status: scheduleRows.length || quotaRows.length ? "ready" : "empty",
        href: "/route-lock/calendar",
        cards: [
          { key: "scheduled_people", label: "Scheduled People", value: String(scheduledAssignments.size) },
          { key: "scheduled_hours", label: "Scheduled Hours", value: String(Math.round(scheduledHours)) },
          { key: "quota_hours", label: "Quota Hours", value: String(Math.round(quotaHours)) },
          { key: "quota_units", label: "Quota Units", value: String(Math.round(quotaUnits)) },
        ],
      },
    ],
  };
}
