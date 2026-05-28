// path: apps/web/src/shared/server/route-lock/ota/otaFirstJobRepository.server.ts

import type { OtaRawJobRow, OtaRosterRow } from "./otaReportTypes";

export async function fetchOtaJobRows(input: {
  admin: any;
  pcOrgId: string;
  from: string;
  to: string;
}): Promise<OtaRawJobRow[]> {
  const { data, error } = await input.admin.rpc(
    "route_lock_ota_first_jobs",
    {
      p_pc_org_id: input.pcOrgId,
      p_from: input.from,
      p_to: input.to,
    }
  );

  if (error) {
    throw Object.assign(new Error(error.message), {
      status: 500,
      detail: error,
    });
  }

  return (data ?? []) as OtaRawJobRow[];
}

export async function fetchOtaRosterRows(input: {
  admin: any;
  pcOrgId: string;
  techIds: string[];
}): Promise<OtaRosterRow[]> {
  if (input.techIds.length === 0) return [];

  const { data, error } = await input.admin
    .from("route_lock_roster_v")
    .select("tech_id,full_name,co_name")
    .eq("pc_org_id", input.pcOrgId)
    .in("tech_id", input.techIds);

  if (error) return [];

  return (data ?? []) as OtaRosterRow[];
}
