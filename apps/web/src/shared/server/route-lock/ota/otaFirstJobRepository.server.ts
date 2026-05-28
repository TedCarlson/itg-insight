// path: apps/web/src/shared/server/route-lock/ota/otaFirstJobRepository.server.ts

import type { OtaRawJobRow, OtaRosterRow } from "./otaReportTypes";

export async function fetchOtaJobRows(input: {
  admin: any;
  pcOrgId: string;
  from: string;
  to: string;
}): Promise<OtaRawJobRow[]> {
  const { data, error } = await input.admin
    .from("check_in_job_row")
    .select(
      [
        "cp_date",
        "tech_id",
        "job_num",
        "work_order_number",
        "job_type",
        "start_time",
        "cp_time",
        "time_slot_start_time",
        "time_slot_end_time",
        "source_tech_last_name",
      ].join(",")
    )
    .eq("pc_org_id", input.pcOrgId)
    .gte("cp_date", input.from)
    .lte("cp_date", input.to)
    .order("cp_date", { ascending: true })
    .order("tech_id", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("cp_time", { ascending: true, nullsFirst: false });

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500, detail: error });
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

export async function fetchCurrentFiscalWindow(input: {
  admin: any;
  today: string;
}): Promise<{ from: string; to: string; label: string }> {
  const { data, error } = await input.admin
    .from("fiscal_month_dim")
    .select("start_date,end_date,label")
    .lte("start_date", input.today)
    .gte("end_date", input.today)
    .maybeSingle();

  if (error || !data?.start_date || !data?.end_date) {
    return {
      from: `${input.today.slice(0, 8)}01`,
      to: input.today,
      label: "Month to date",
    };
  }

  const endDate = String(data.end_date);
  return {
    from: String(data.start_date),
    to: input.today < endDate ? input.today : endDate,
    label: data.label ? String(data.label) : "Fiscal month to date",
  };
}
