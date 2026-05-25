// path: apps/web/src/features/tech/schedule/lib/getTechScheduleCalendar.ts

import { getTechShellContext } from "@/features/tech/lib/getTechShellContext";

import {
  loadScheduleSurfacePayload,
} from "@/shared/schedule/server/loadScheduleSurfacePayload.server";

export type TechScheduleDay = {
  date: string;
  scheduled: boolean;
  routeArea: string | null;
  phase: "planned" | "built" | "actual" | "none";
  plannedUnits: number | null;
  builtUnits: number | null;
  actualUnits: number | null;
  hasShiftValidation: boolean;
  hasCheckIn: boolean;
  dispatchBadges: string[];
  latestNote: string | null;
  isBlackout: boolean;
  blackoutLabel: string | null;
  blackoutType: string | null;
};

export type TechScheduleCalendarPayload = {
  ok: boolean;
  reason: "ok" | "no_org" | "no_auth_user" | "no_person" | "no_active_assignment";
  monthLabel: string;
  year: number;
  month: number; // 0-based
  todayIso: string;
  scheduledDates: Set<string>;
  daysByDate: Map<string, TechScheduleDay>;
};

function isoTodayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIsoUtc(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

function monthEndIsoUtc(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
}

function monthLabelUtc(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildDispatchBadges(
  row: Awaited<ReturnType<typeof loadScheduleSurfacePayload>>["rows"][number],
) {
  const badges: string[] = [];

  if (row.dispatch.callOut) badges.push("Coverage Gap");
  if (row.dispatch.addIn) badges.push("Add-In");
  if (row.dispatch.techMove) badges.push("Move");
  if (row.dispatch.incidentCount > 0) badges.push("Incident");
  if (row.dispatch.noteCount > 0) badges.push("Note");

  return badges;
}

export async function getTechScheduleCalendar(): Promise<TechScheduleCalendarPayload> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const todayIso = isoTodayUtc();
  const startIso = monthStartIsoUtc(year, month);
  const endIso = monthEndIsoUtc(year, month);
  const shell = await getTechShellContext();

  if (!shell.ok || !shell.assignment_id) {
    return {
      ok: false,
      reason: shell.reason,
      monthLabel: monthLabelUtc(year, month),
      year,
      month,
      todayIso,
      scheduledDates: new Set<string>(),
      daysByDate: new Map<string, TechScheduleDay>(),
    };
  }

  const payload =
    await loadScheduleSurfacePayload({
      pcOrgId: shell.pc_org_id,
      supervisorAssignmentId: null,
      contractorId: null,
      startDate: startIso,
      endDate: endIso,
      viewMode: "month",
      roleContext: null,
      forceScope: "TECH_SELF",
      forceAssignmentIds: [shell.assignment_id],
      search: null,
    });

  const daysByDate =
    new Map<string, TechScheduleDay>();

  for (const row of payload.rows) {
    const scheduled =
      row.assignmentId === shell.assignment_id &&
      row.baseSchedule.scheduled === true;

    const blackoutDay =
      payload.blackoutByDate?.[row.date] ?? null;

    const blackoutRule =
      blackoutDay?.rules?.[0] ?? null;

    daysByDate.set(row.date, {
      date: row.date,
      scheduled,
      routeArea: scheduled ? row.baseSchedule.routeArea : null,
      phase: scheduled ? row.routeLock.phase : "none",
      plannedUnits: scheduled ? row.routeLock.plannedUnits : null,
      builtUnits: scheduled ? row.routeLock.builtUnits : null,
      actualUnits: scheduled ? row.routeLock.actualUnits : null,
      hasShiftValidation: scheduled ? row.routeLock.hasShiftValidation : false,
      hasCheckIn: scheduled ? row.routeLock.hasCheckIn : false,
      dispatchBadges: scheduled ? buildDispatchBadges(row) : [],
      latestNote: scheduled ? row.dispatch.latestNote : null,
      isBlackout: Boolean(blackoutDay?.rules?.length),
      blackoutLabel: blackoutRule?.label ?? null,
      blackoutType: blackoutRule?.blackoutType ?? null,
    });
  }

  for (const [date, blackoutDay] of Object.entries(payload.blackoutByDate ?? {})) {
    if (daysByDate.has(date)) {
      continue;
    }

    const blackoutRule =
      blackoutDay.rules?.[0] ?? null;

    daysByDate.set(date, {
      date,
      scheduled: false,
      routeArea: null,
      phase: "none",
      plannedUnits: null,
      builtUnits: null,
      actualUnits: null,
      hasShiftValidation: false,
      hasCheckIn: false,
      dispatchBadges: [],
      latestNote: null,
      isBlackout: Boolean(blackoutDay.rules?.length),
      blackoutLabel: blackoutRule?.label ?? null,
      blackoutType: blackoutRule?.blackoutType ?? null,
    });
  }

  return {
    ok: true,
    reason: "ok",
    monthLabel: monthLabelUtc(year, month),
    year,
    month,
    todayIso,
    scheduledDates: new Set(
      Array.from(daysByDate.values())
        .filter((day) => day.scheduled)
        .map((day) => day.date),
    ),
    daysByDate,
  };
}
