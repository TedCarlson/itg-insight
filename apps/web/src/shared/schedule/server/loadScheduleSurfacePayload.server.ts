// path: apps/web/src/shared/schedule/server/loadScheduleSurfacePayload.server.ts

import type {
  ScheduleSurfaceFilters,
  ScheduleSurfacePayload,
  ScheduleSurfaceRow,
} from "../types/scheduleSurfaceTypes";

import {
  resolveScheduleScope,
} from "./resolveScheduleScope.server";

import {
  buildScheduleSurfaceSummary,
} from "./buildScheduleSurfaceSummary.server";

import {
  loadScheduleRows,
} from "./loadScheduleRows.server";

import {
  resolveScheduleDateRange,
} from "./resolveScheduleDateRange.server";

import {
  loadDispatchDayFacts,
} from "@/shared/server/dispatch/loadDispatchDayFacts.server";

import {
  buildScheduleDailySummaries,
} from "./buildScheduleDailySummaries.server";

import {
  supabaseAdmin,
} from "@/shared/data/supabase/admin";

import {
  loadBlackoutCalendar,
} from "@/shared/server/calendar/loadBlackoutCalendar.server";

type SourceCountRow = {
  shift_date: string | null;
  tech_id?: string | null;
  tech_num?: string | null;
};

export async function loadScheduleSurfacePayload(
  filters: ScheduleSurfaceFilters,
): Promise<ScheduleSurfacePayload> {

  const scope = await resolveScheduleScope({
    forceScope: filters.forceScope ?? null,
    forceAssignmentIds: filters.forceAssignmentIds ?? null,
  });

  /**
   * NEXT PASS
   *
   * 1. load baseline schedule facts
   * 2. merge route lock overlays
   * 3. merge dispatch overlays
   * 4. apply scoped visibility
   * 5. map rows into stable UI contract
   */

  void scope;

  const resolvedRange =
    resolveScheduleDateRange({
      viewMode: filters.viewMode,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

  const resolvedFilters = {
    ...filters,
    startDate: resolvedRange.startDate,
    endDate: resolvedRange.endDate,
  };


  const pcOrgIds =
    resolvedFilters.pcOrgId
      ? [resolvedFilters.pcOrgId]
      : scope.allowedPcOrgIds;

  const rows: ScheduleSurfaceRow[] =
    await loadScheduleRows({
      scope: scope.scope,
      contractorId: scope.contractorId,
      assignmentIds: scope.assignmentIds,
      search: resolvedFilters.search ?? null,
      pcOrgIds,
      startDate: resolvedFilters.startDate,
      endDate: resolvedFilters.endDate,
    });

  const admin =
    supabaseAdmin();

  const { data: capacityRows, error: capacityError } =
    await admin
      .from("workforce_current_v")
      .select("assignment_id,role_type,is_active")
      .in("pc_org_id", pcOrgIds)
      .eq("is_active", true)
      .in("role_type", ["FIELD", "TRAVEL"]);

  if (capacityError) {
    throw new Error(
      `schedule capacity lookup failed: ${capacityError.message}`,
    );
  }

  const activeCapacityCount =
    new Set(
      ((capacityRows ?? []) as Array<{ assignment_id: string | null }>)
        .map((row) => String(row.assignment_id ?? "").trim())
        .filter(Boolean),
    ).size;

  const dispatchFacts =
    await loadDispatchDayFacts({
      pcOrgIds,
      startDate: resolvedFilters.startDate,
      endDate: resolvedFilters.endDate,
    });

  const sourceCountByDate =
    new Map<string, {
      planned: Set<string>;
      built: Set<string>;
      actual: Set<string>;
    }>();

  function getSourceBucket(date: string) {
    const existing =
      sourceCountByDate.get(date);

    if (existing) {
      return existing;
    }

    const next = {
      planned: new Set<string>(),
      built: new Set<string>(),
      actual: new Set<string>(),
    };

    sourceCountByDate.set(date, next);

    return next;
  }

  const { data: plannedSourceRows, error: plannedSourceError } =
    await admin
      .from("schedule_day_fact")
      .select("shift_date,tech_id")
      .in("pc_org_id", pcOrgIds)
      .gte("shift_date", resolvedFilters.startDate)
      .lte("shift_date", resolvedFilters.endDate);

  if (plannedSourceError) {
    throw new Error(
      `schedule planned source count lookup failed: ${plannedSourceError.message}`,
    );
  }

  for (const row of ((plannedSourceRows ?? []) as SourceCountRow[])) {
    const date = String(row.shift_date ?? "").trim();
    const techId = String(row.tech_id ?? "").trim();

    if (date && techId) {
      getSourceBucket(date).planned.add(techId);
    }
  }

  const { data: builtSourceRows, error: builtSourceError } =
    await admin
      .from("shift_validation_row")
      .select("shift_date,tech_num")
      .in("pc_org_id", pcOrgIds)
      .gte("shift_date", resolvedFilters.startDate)
      .lte("shift_date", resolvedFilters.endDate);

  if (builtSourceError) {
    throw new Error(
      `schedule built source count lookup failed: ${builtSourceError.message}`,
    );
  }

  for (const row of ((builtSourceRows ?? []) as SourceCountRow[])) {
    const date = String(row.shift_date ?? "").trim();
    const techId = String(row.tech_num ?? "").trim();

    if (date && techId) {
      getSourceBucket(date).built.add(techId);
    }
  }

  const { data: actualSourceRows, error: actualSourceError } =
    await admin
      .from("check_in_day_fact")
      .select("shift_date,tech_id")
      .in("pc_org_id", pcOrgIds)
      .gte("shift_date", resolvedFilters.startDate)
      .lte("shift_date", resolvedFilters.endDate);

  if (actualSourceError) {
    throw new Error(
      `schedule actual source count lookup failed: ${actualSourceError.message}`,
    );
  }

  for (const row of ((actualSourceRows ?? []) as SourceCountRow[])) {
    const date = String(row.shift_date ?? "").trim();
    const techId = String(row.tech_id ?? "").trim();

    if (date && techId) {
      getSourceBucket(date).actual.add(techId);
    }
  }

  const sourceCounts =
    Array.from(sourceCountByDate.entries()).map(([date, counts]) => ({
      date,
      plannedBookedCount: counts.planned.size,
      builtBookedCount: counts.built.size,
      actualBookedCount: counts.actual.size,
    }));

  const blackoutCalendar =
    await loadBlackoutCalendar({
      countryCode: "US",
      startDate: resolvedFilters.startDate,
      endDate: resolvedFilters.endDate,
    });

  const blackoutByDate =
    Object.fromEntries(
      Array.from(blackoutCalendar.entries()),
    );

  const dailySummaries =
    buildScheduleDailySummaries({
      startDate: resolvedFilters.startDate,
      endDate: resolvedFilters.endDate,
      rows,
      dispatchFacts,
      activeCapacityCount,
      sourceCounts,
    });

  return {
    generatedAt: new Date().toISOString(),

    filters: resolvedFilters,

    summary:
      buildScheduleSurfaceSummary(rows),

    dailySummaries,

    rows,

    blackoutByDate,
  };
}
