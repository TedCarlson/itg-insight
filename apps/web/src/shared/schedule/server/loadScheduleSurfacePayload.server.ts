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

export async function loadScheduleSurfacePayload(
  filters: ScheduleSurfaceFilters,
): Promise<ScheduleSurfacePayload> {

  const scope = await resolveScheduleScope();

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
      pcOrgIds,
      startDate: resolvedFilters.startDate,
      endDate: resolvedFilters.endDate,
    });

  const dispatchFacts =
    await loadDispatchDayFacts({
      pcOrgIds,
      startDate: resolvedFilters.startDate,
      endDate: resolvedFilters.endDate,
    });

  const dailySummaries =
    buildScheduleDailySummaries({
      startDate: resolvedFilters.startDate,
      endDate: resolvedFilters.endDate,
      rows,
      dispatchFacts,
    });

  return {
    generatedAt: new Date().toISOString(),

    filters: resolvedFilters,

    summary:
      buildScheduleSurfaceSummary(rows),

    dailySummaries,

    rows,
  };
}
