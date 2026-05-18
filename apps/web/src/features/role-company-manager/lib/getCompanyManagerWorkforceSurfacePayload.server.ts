// path: apps/web/src/features/role-company-manager/lib/getCompanyManagerWorkforceSurfacePayload.server.ts

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { buildWorkforceSurfacePayload } from "@/shared/server/workforce/buildWorkforceSurfacePayload.server";
import { loadWorkforceSourceRows } from "@/shared/server/workforce/loadWorkforceSourceRows.server";
import type { WorkforceSurfacePayload } from "@/shared/types/workforce/surfacePayload";

type Args = {
  as_of_date?: string | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildEmptyPayload(): WorkforceSurfacePayload {
  return {
    rows: [],
    tabs: [
      { key: "ALL", label: "All", count: 0 },
      { key: "FIELD", label: "Field", count: 0 },
      { key: "LEADERSHIP", label: "Leadership", count: 0 },
      { key: "INCOMPLETE", label: "Incomplete", count: 0 },
      { key: "TRAVEL", label: "Travel Techs", count: 0 },
    ],
    summary: {
      total: 0,
      field: 0,
      training: 0,
      leadership: 0,
      support: 0,
      incomplete: 0,
      travel: 0,
      drop_bury: 0,
      fmla: 0,
    },
    slices: {
      offices: [],
      reportsTo: [],
      positions: [],
      affiliations: [],
      seatTypes: [],
    },
  };
}

export async function getCompanyManagerWorkforceSurfacePayload(
  args?: Args
): Promise<WorkforceSurfacePayload> {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) return buildEmptyPayload();

  const as_of_date = String(args?.as_of_date ?? "").trim() || todayIso();

  const sourceRows = await loadWorkforceSourceRows({
    pc_org_id: scope.selected_pc_org_id,
    as_of_date,
  });

  return await buildWorkforceSurfacePayload({
    rows: sourceRows,
  });
}