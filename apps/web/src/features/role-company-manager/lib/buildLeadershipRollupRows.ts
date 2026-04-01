import type { WorkforceRosterRow } from "@/shared/ui/workforce/table/workforceTable.types";

import type { CompanyManagerLeadershipRow } from "./companyManagerView.types";

export function buildLeadershipRollupRows(
  rows: WorkforceRosterRow[]
): CompanyManagerLeadershipRow[] {
  const leaderMap = new Map<string, CompanyManagerLeadershipRow>();

  for (const row of rows) {
    // For now, we use contractor_name as proxy for leader grouping.
    // This can later be replaced with real supervisor/manager linkage.
    const leaderName =
      row.contractor_name?.trim() || "Unassigned Leader";

    const existing = leaderMap.get(leaderName);

    if (existing) {
      existing.tech_count += 1;
      existing.total_jobs += row.work_mix.total;
      existing.risk_count += row.below_target_count;
      continue;
    }

    leaderMap.set(leaderName, {
      leader_name: leaderName,
      team_count: 1, // placeholder until true team grouping is wired
      tech_count: 1,
      total_jobs: row.work_mix.total,
      risk_count: row.below_target_count,
    });
  }

  return Array.from(leaderMap.values()).sort((a, b) => {
    if (b.total_jobs !== a.total_jobs) return b.total_jobs - a.total_jobs;
    return a.leader_name.localeCompare(b.leader_name);
  });
}