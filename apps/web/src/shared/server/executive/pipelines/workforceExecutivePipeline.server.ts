// path: apps/web/src/shared/server/executive/pipelines/workforceExecutivePipeline.server.ts

import { loadWorkforceSourceRows } from "@/shared/server/workforce/loadWorkforceSourceRows.server";
import type { ExecutiveDimensionPayload } from "@/shared/types/executive/executiveSuite";

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)).size;
}

export async function buildWorkforceExecutiveDimension(args: {
  pc_org_id: string;
  as_of_date: string;
}): Promise<ExecutiveDimensionPayload> {
  const rows = await loadWorkforceSourceRows({
    pc_org_id: args.pc_org_id,
    as_of_date: args.as_of_date,
  });

  const activeRows = rows.filter((row) => row.is_active);
  const fieldRows = activeRows.filter((row) => row.is_field || row.is_travel_tech);
  const leadershipRows = activeRows.filter((row) => row.is_leadership);
  const incompleteRows = activeRows.filter((row) => row.is_incomplete);

  return {
    dimension: "workforce",
    title: "Workforce",
    status: activeRows.length ? "ready" : "empty",
    artifacts: [
      {
        key: "headcount",
        title: "Headcount",
        description: "Active workforce snapshot for the selected org.",
        status: activeRows.length ? "ready" : "empty",
        href: "/company-manager/workforce",
        cards: [
          { key: "active_people", label: "Active People", value: String(activeRows.length) },
          { key: "field_contributors", label: "Field Contributors", value: String(fieldRows.length) },
          { key: "leadership", label: "Leadership", value: String(leadershipRows.length) },
          { key: "offices", label: "Offices", value: String(uniqueCount(activeRows.map((row) => row.office_id))) },
        ],
      },
      {
        key: "assignment_health",
        title: "Assignment Health",
        description: "Completeness and reporting-line readiness for leadership reporting.",
        status: incompleteRows.length ? "degraded" : "ready",
        href: "/company-manager/workforce",
        cards: [
          { key: "incomplete", label: "Incomplete Rows", value: String(incompleteRows.length), status: incompleteRows.length ? "degraded" : "ready" },
          { key: "with_supervisor", label: "With Supervisor", value: String(activeRows.filter((row) => row.reports_to_person_id).length) },
          { key: "affiliations", label: "Affiliations", value: String(uniqueCount(activeRows.map((row) => row.affiliation_id ?? row.affiliation))) },
        ],
      },
    ],
  };
}
