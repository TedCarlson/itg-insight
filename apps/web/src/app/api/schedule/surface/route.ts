// path: apps/web/src/app/api/schedule/surface/route.ts

import { NextRequest, NextResponse } from "next/server";

import {
  loadScheduleSurfacePayload,
} from "@/shared/schedule/server/loadScheduleSurfacePayload.server";

import type {
  ScheduleSurfaceFilters,
} from "@/shared/schedule/types/scheduleSurfaceTypes";

export const runtime = "nodejs";

function parseFilters(
  request: NextRequest,
): ScheduleSurfaceFilters {

  const search = request.nextUrl.searchParams;

  return {
    pcOrgId:
      search.get("pc_org_id"),

    supervisorAssignmentId:
      search.get("supervisor_assignment_id"),

    contractorId:
      search.get("contractor_id"),

    startDate:
      search.get("start_date")
      ?? new Date().toISOString().slice(0, 10),

    endDate:
      search.get("end_date")
      ?? new Date().toISOString().slice(0, 10),

    viewMode:
      (search.get("view_mode") as
        | "day"
        | "week"
        | "month"
        | "list")
      ?? "day",
  };
}

export async function GET(
  request: NextRequest,
) {
  try {

    const filters =
      parseFilters(request);

    const payload =
      await loadScheduleSurfacePayload(filters);

    return NextResponse.json({
      ok: true,
      payload,
    });

  } catch (error) {

    console.error(
      "schedule_surface_failed",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "schedule_surface_failed",
      },
      {
        status: 500,
      },
    );
  }
}
