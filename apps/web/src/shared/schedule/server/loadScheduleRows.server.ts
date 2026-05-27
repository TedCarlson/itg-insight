// path: apps/web/src/shared/schedule/server/loadScheduleRows.server.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";

import type {
  ScheduleSurfaceRow,
} from "../types/scheduleSurfaceTypes";

type LoadScheduleRowsArgs = {
  scope:
    | "ALL_ORG"
    | "BP_CONTRACTOR"
    | "BP_SUPERVISOR"
    | "TECH_SELF";

  contractorId: string | null;

  assignmentIds: string[];

  search: string | null;

  pcOrgIds: string[];

  startDate: string;
  endDate: string;
};

type WorkforceRow = {
  assignment_id: string | null;
  person_id: string | null;
  pc_org_id: string | null;

  tech_id: string | null;
  full_name: string | null;

  office_id: string | null;

  is_active: boolean | null;

  affiliation_id: string | null;
  affiliation_code: string | null;
  affiliation: string | null;
};

type ScheduleFactRow = {
  assignment_id: string | null;
  pc_org_id: string | null;

  shift_date: string | null;

  planned_route_id: string | null;
  plan_source: string | null;
};

type RouteRow = {
  route_id: string | null;
  route_name: string | null;
};

type DispatchLogRow = {
  assignment_id: string | null;
  person_id: string | null;
  tech_id: string | null;
  shift_date: string | null;
  event_type: string | null;
  capacity_delta_routes: number | string | null;
  message: string | null;
};

type ShiftValidationRow = {
  shift_date: string | null;
  tech_num: string | null;
  is_work: boolean | null;
  is_bplow: boolean | null;
  is_prjt: boolean | null;
  work_units: number | string | null;
};

type CheckInDayFactRow = {
  shift_date: string | null;
  tech_id: string | null;
  actual_units: number | string | null;
};

type OrgRow = {
  pc_org_id: string | null;
  pc_org_name: string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function loadScheduleRows(
  args: LoadScheduleRowsArgs,
): Promise<ScheduleSurfaceRow[]> {

  if (!args.pcOrgIds.length) {
    return [];
  }

  const admin = supabaseAdmin();

  const { data: workforceRows, error: workforceError } =
    await admin
      .from("workforce_current_v")
      .select(
        [
          "assignment_id",
          "person_id",
          "pc_org_id",
          "tech_id",
          "full_name",
          "office_id",
          "is_active",
          "affiliation_id",
          "affiliation_code",
          "affiliation",
        ].join(","),
      )
      .in("pc_org_id", args.pcOrgIds);

  if (workforceError) {
    throw new Error(
      `schedule workforce lookup failed: ${workforceError.message}`,
    );
  }

  let scopedWorkforceRows =
    ((workforceRows ?? []) as unknown as WorkforceRow[]);

  if (
    args.scope === "BP_CONTRACTOR" &&
    args.contractorId
  ) {
    scopedWorkforceRows =
      scopedWorkforceRows.filter(
        (row) =>
          clean(row.affiliation_id) === args.contractorId,
      );
  }

  if (
    (
      args.scope === "BP_SUPERVISOR" ||
      args.scope === "TECH_SELF"
    ) &&
    args.assignmentIds.length
  ) {
    const allowedAssignments =
      new Set(args.assignmentIds);

    scopedWorkforceRows =
      scopedWorkforceRows.filter(
        (row) =>
          allowedAssignments.has(
            clean(row.assignment_id),
          ),
      );
  }

  let factQuery =
    admin
      .from("schedule_day_fact")
      .select(
        [
          "assignment_id",
          "pc_org_id",
          "shift_date",
          "planned_route_id",
          "plan_source",
        ].join(","),
      )
      .in("pc_org_id", args.pcOrgIds)
      .gte("shift_date", args.startDate)
      .lte("shift_date", args.endDate);

  if (
    (
      args.scope === "BP_SUPERVISOR" ||
      args.scope === "TECH_SELF"
    ) &&
    args.assignmentIds.length
  ) {
    factQuery =
      factQuery.in("assignment_id", args.assignmentIds);
  }

  const search =
    clean(args.search).toLowerCase();

  if (search) {
    scopedWorkforceRows =
      scopedWorkforceRows.filter((row) => {
        const haystack =
          [
            row.tech_id,
            row.full_name,
            row.affiliation_code,
            row.affiliation,
          ]
            .map((value) => clean(value).toLowerCase())
            .join(" ");

        return haystack.includes(search);
      });
  }

  const { data: factRows, error: factError } =
    await factQuery;

  if (factError) {
    throw new Error(
      `schedule fact lookup failed: ${factError.message}`,
    );
  }

  const { data: dispatchRows, error: dispatchError } =
    await admin
      .from("dispatch_console_log")
      .select(
        [
          "assignment_id",
          "person_id",
          "tech_id",
          "shift_date",
          "event_type",
          "capacity_delta_routes",
          "message",
        ].join(","),
      )
      .in("pc_org_id", args.pcOrgIds)
      .gte("shift_date", args.startDate)
      .lte("shift_date", args.endDate);

  if (dispatchError) {
    throw new Error(
      `schedule dispatch lookup failed: ${dispatchError.message}`,
    );
  }

  const { data: svRows, error: svError } =
    await admin
      .from("shift_validation_row")
      .select(
        [
          "shift_date",
          "tech_num",
          "is_work",
          "is_bplow",
          "is_prjt",
          "work_units",
        ].join(","),
      )
      .in("pc_org_id", args.pcOrgIds)
      .gte("shift_date", args.startDate)
      .lte("shift_date", args.endDate);

  if (svError) {
    throw new Error(
      `schedule shift validation lookup failed: ${svError.message}`,
    );
  }

  const svByTechDate =
    new Map<string, { builtUnits: number }>();

  for (const row of ((svRows ?? []) as unknown as ShiftValidationRow[])) {
    const shiftDate =
      clean(row.shift_date);

    const techId =
      clean(row.tech_num);

    if (!shiftDate || !techId) {
      continue;
    }

    const isBuilt =
      row.is_work === true ||
      row.is_bplow === true ||
      row.is_prjt === true;

    if (!isBuilt) {
      continue;
    }

    const n =
      Number(row.work_units ?? 0);

    const units =
      Number.isFinite(n) ? n : 0;

    const key =
      `${techId}:${shiftDate}`;

    const existing =
      svByTechDate.get(key) ?? { builtUnits: 0 };

    existing.builtUnits += units;

    svByTechDate.set(key, existing);
  }

  const { data: checkInRows, error: checkInError } =
    await admin
      .from("check_in_day_fact")
      .select(
        [
          "shift_date",
          "tech_id",
          "actual_units",
        ].join(","),
      )
      .in("pc_org_id", args.pcOrgIds)
      .gte("shift_date", args.startDate)
      .lte("shift_date", args.endDate);

  if (checkInError) {
    throw new Error(
      `schedule check-in lookup failed: ${checkInError.message}`,
    );
  }

  const checkInByTechDate =
    new Map<string, { actualUnits: number }>();

  for (const row of ((checkInRows ?? []) as unknown as CheckInDayFactRow[])) {
    const shiftDate =
      clean(row.shift_date);

    const techId =
      clean(row.tech_id);

    if (!shiftDate || !techId) {
      continue;
    }

    const n =
      Number(row.actual_units ?? 0);

    const units =
      Number.isFinite(n) ? n : 0;

    const key =
      `${techId}:${shiftDate}`;

    const existing =
      checkInByTechDate.get(key) ?? { actualUnits: 0 };

    existing.actualUnits += units;

    checkInByTechDate.set(key, existing);
  }

  const dispatchByAssignmentDate =
    new Map<string, DispatchLogRow[]>();

  for (const dispatch of ((dispatchRows ?? []) as unknown as DispatchLogRow[])) {
    const assignmentId =
      clean(dispatch.assignment_id);

    const shiftDate =
      clean(dispatch.shift_date);

    if (!assignmentId || !shiftDate) {
      continue;
    }

    const key =
      `${assignmentId}:${shiftDate}`;

    const existing =
      dispatchByAssignmentDate.get(key) ?? [];

    existing.push(dispatch);

    dispatchByAssignmentDate.set(
      key,
      existing,
    );
  }

  const routeIds =
    Array.from(
      new Set(
        ((factRows ?? []) as unknown as ScheduleFactRow[])
          .map((row) => clean(row.planned_route_id))
          .filter(Boolean),
      ),
    );

  const routeNameById =
    new Map<string, string>();

  if (routeIds.length) {
    const { data: routeRows, error: routeError } =
      await admin
        .from("route")
        .select("route_id,route_name")
        .in("route_id", routeIds);

    if (routeError) {
      throw new Error(
        `schedule route lookup failed: ${routeError.message}`,
      );
    }

    for (const route of ((routeRows ?? []) as unknown as RouteRow[])) {
      const routeId = clean(route.route_id);
      const routeName = clean(route.route_name);

      if (routeId && routeName) {
        routeNameById.set(routeId, routeName);
      }
    }
  }

  const { data: orgRows, error: orgError } =
    await admin
      .from("pc_org")
      .select("pc_org_id,pc_org_name")
      .in("pc_org_id", args.pcOrgIds);

  if (orgError) {
    throw new Error(
      `schedule org lookup failed: ${orgError.message}`,
    );
  }

  const orgNameById =
    new Map<string, string>();

  for (const org of ((orgRows ?? []) as unknown as OrgRow[])) {

    const orgId =
      clean(org.pc_org_id);

    const orgName =
      clean(org.pc_org_name);

    if (orgId && orgName) {
      orgNameById.set(orgId, orgName);
    }
  }

  const workforceByAssignment =
    new Map<string, WorkforceRow>();

  const workforceByTech =
    new Map<string, WorkforceRow>();

  for (const row of scopedWorkforceRows) {

    const assignmentId =
      clean(row.assignment_id);

    const personId =
      clean(row.person_id);

    const techId =
      clean(row.tech_id);

    if (!assignmentId || !personId) {
      continue;
    }

    workforceByAssignment.set(
      assignmentId,
      row,
    );

    if (techId) {
      workforceByTech.set(
        techId,
        row,
      );
    }
  }

  const rows: ScheduleSurfaceRow[] = [];

  const existingTechDateKeys =
    new Set<string>();

  for (const fact of ((factRows ?? []) as unknown as ScheduleFactRow[])) {

    const assignmentId =
      clean(fact.assignment_id);

    const workforce =
      workforceByAssignment.get(assignmentId);

    if (!workforce) {
      continue;
    }

    const factDate =
      clean(fact.shift_date);

    const dispatchEvents =
      dispatchByAssignmentDate.get(`${assignmentId}:${factDate}`) ?? [];

    const techId =
      clean(workforce.tech_id);

    const sv =
      args.scope === "TECH_SELF"
        ? null
        : techId
          ? svByTechDate.get(`${techId}:${factDate}`) ?? null
          : null;

    const checkIn =
      args.scope === "TECH_SELF"
        ? null
        : techId
          ? checkInByTechDate.get(`${techId}:${factDate}`) ?? null
          : null;

    const hasShiftValidation =
      !!sv;

    const hasCheckIn =
      !!checkIn;

    const routePhase =
      hasCheckIn
        ? "actual"
        : hasShiftValidation
          ? "built"
          : "planned";

    const latestNote =
      dispatchEvents
        .map((event) => clean(event.message))
        .filter(Boolean)
        .at(-1)
      ?? null;

    const capacityDelta =
      dispatchEvents.reduce((sum, event) => {
        const n = Number(event.capacity_delta_routes ?? 0);
        return Number.isFinite(n) ? sum + n : sum;
      }, 0);

    if (techId && factDate) {
      existingTechDateKeys.add(`${techId}:${factDate}`);
    }

    if (techId && factDate) {
      existingTechDateKeys.add(`${techId}:${factDate}`);
    }

    rows.push({
      date:
        factDate,

      personId:
        clean(workforce.person_id),

      assignmentId,

      techId:
        techId || null,

      fullName:
        clean(workforce.full_name) || "Unknown",

      pcOrgId:
        clean(workforce.pc_org_id),

      pcOrgName:
        orgNameById.get(clean(workforce.pc_org_id))
        ?? null,

      officeId:
        clean(workforce.office_id) || null,

      officeName: null,

      supervisorName: null,

      contractorId:
        clean(workforce.affiliation_id) || null,

      contractorName:
        clean(workforce.affiliation) || null,

      affiliationCode:
        clean(workforce.affiliation_code) || null,

      affiliationName:
        clean(workforce.affiliation) || null,

      baseSchedule: {
        scheduled: true,

        routeArea:
          routeNameById.get(clean(fact.planned_route_id))
          || clean(fact.planned_route_id)
          || null,

        startTime: null,
        endTime: null,

        source: "day_fact",
      },

      routeLock: {
        phase: routePhase,

        plannedUnits: null,
        builtUnits: sv?.builtUnits ?? null,
        actualUnits: checkIn?.actualUnits ?? null,

        hasShiftValidation,
        hasCheckIn,
      },

      dispatch: {
        callOut:
          dispatchEvents.some((event) => clean(event.event_type) === "CALL_OUT"),

        addIn:
          dispatchEvents.some((event) => clean(event.event_type) === "ADD_IN"),

        techMove:
          dispatchEvents.some((event) => clean(event.event_type) === "TECH_MOVE"),

        bpLow:
          dispatchEvents.some((event) => clean(event.event_type) === "BP_LOW"),

        incidentCount:
          dispatchEvents.filter((event) => clean(event.event_type) === "INCIDENT").length,

        noteCount:
          dispatchEvents.filter((event) => clean(event.event_type) === "NOTE").length,

        capacityDeltaRoutes:
          capacityDelta === 0 ? null : capacityDelta,

        latestNote,
      },
    });
  }

  const overlayTechDateKeys =
    new Set<string>([
      ...Array.from(svByTechDate.keys()),
      ...Array.from(checkInByTechDate.keys()),
    ]);

  for (const key of overlayTechDateKeys) {
    if (existingTechDateKeys.has(key)) {
      continue;
    }

    const [techId, factDate] =
      key.split(":");

    if (!techId || !factDate) {
      continue;
    }

    const workforce =
      workforceByTech.get(techId);

    if (!workforce) {
      continue;
    }

    const assignmentId =
      clean(workforce.assignment_id);

    if (!assignmentId) {
      continue;
    }

    const sv =
      svByTechDate.get(key) ?? null;

    const checkIn =
      checkInByTechDate.get(key) ?? null;

    const dispatchEvents =
      dispatchByAssignmentDate.get(`${assignmentId}:${factDate}`) ?? [];

    const latestNote =
      dispatchEvents
        .map((event) => clean(event.message))
        .filter(Boolean)
        .at(-1)
      ?? null;

    const capacityDelta =
      dispatchEvents.reduce((sum, event) => {
        const n = Number(event.capacity_delta_routes ?? 0);
        return Number.isFinite(n) ? sum + n : sum;
      }, 0);

    if (techId && factDate) {
      existingTechDateKeys.add(`${techId}:${factDate}`);
    }

    rows.push({
      date:
        factDate,

      personId:
        clean(workforce.person_id),

      assignmentId,

      techId,

      fullName:
        clean(workforce.full_name) || "Unknown",

      pcOrgId:
        clean(workforce.pc_org_id),

      pcOrgName:
        orgNameById.get(clean(workforce.pc_org_id))
        ?? null,

      officeId:
        clean(workforce.office_id) || null,

      officeName: null,

      supervisorName: null,

      contractorId:
        clean(workforce.affiliation_id) || null,

      contractorName:
        clean(workforce.affiliation) || null,

      affiliationCode:
        clean(workforce.affiliation_code) || null,

      affiliationName:
        clean(workforce.affiliation) || null,

      baseSchedule: {
        scheduled: true,
        routeArea: null,
        startTime: null,
        endTime: null,
        source: "none",
      },

      routeLock: {
        phase:
          checkIn
            ? "actual"
            : "built",

        plannedUnits: null,
        builtUnits: sv?.builtUnits ?? null,
        actualUnits: checkIn?.actualUnits ?? null,

        hasShiftValidation: !!sv,
        hasCheckIn: !!checkIn,
      },

      dispatch: {
        callOut:
          dispatchEvents.some((event) => clean(event.event_type) === "CALL_OUT"),

        addIn:
          dispatchEvents.some((event) => clean(event.event_type) === "ADD_IN"),

        techMove:
          dispatchEvents.some((event) => clean(event.event_type) === "TECH_MOVE"),

        bpLow:
          dispatchEvents.some((event) => clean(event.event_type) === "BP_LOW"),

        incidentCount:
          dispatchEvents.filter((event) => clean(event.event_type) === "INCIDENT").length,

        noteCount:
          dispatchEvents.filter((event) => clean(event.event_type) === "NOTE").length,

        capacityDeltaRoutes:
          capacityDelta === 0 ? null : capacityDelta,

        latestNote,
      },
    });
  }

  return rows;
}
