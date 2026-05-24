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
      scope: scope.scope,
      contractorId: scope.contractorId,
      assignmentIds: scope.assignmentIds,
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

  const dailySummaries =
    buildScheduleDailySummaries({
      startDate: resolvedFilters.startDate,
      endDate: resolvedFilters.endDate,
      rows,
      dispatchFacts,
      activeCapacityCount,
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
