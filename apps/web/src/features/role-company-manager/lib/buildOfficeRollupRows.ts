import type { WorkforceRosterRow } from "@/shared/ui/workforce/table/workforceTable.types";

import type { CompanyManagerOfficeRow } from "./companyManagerView.types";

export function buildOfficeRollupRows(
  rows: WorkforceRosterRow[]
): CompanyManagerOfficeRow[] {
  const officeMap = new Map<string, CompanyManagerOfficeRow>();

  for (const row of rows) {
    const officeName =
      row.rank_context?.division != null
        ? "Assigned Office"
        : row.team_class?.trim() || "Unassigned";

    const existing = officeMap.get(officeName);

    if (existing) {
      existing.tech_count += 1;
      existing.total_jobs += row.work_mix.total;
      existing.installs += row.work_mix.installs;
      existing.tcs += row.work_mix.tcs;
      existing.sros += row.work_mix.sros;
      existing.risk_count += row.below_target_count;
      continue;
    }

    officeMap.set(officeName, {
      office_name: officeName,
      tech_count: 1,
      total_jobs: row.work_mix.total,
      installs: row.work_mix.installs,
      tcs: row.work_mix.tcs,
      sros: row.work_mix.sros,
      risk_count: row.below_target_count,
    });
  }

  return Array.from(officeMap.values()).sort((a, b) => {
    if (b.total_jobs !== a.total_jobs) return b.total_jobs - a.total_jobs;
    return a.office_name.localeCompare(b.office_name);
  });
}