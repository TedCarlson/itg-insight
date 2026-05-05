// path: apps/web/src/shared/server/metrics/reports/buildRollupReportPayload.server.ts

import { mapTeamRows, type TeamRowClient } from "@/shared/lib/metrics/buildScopedRows";
import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";

import {
  getUniqueSupervisors,
  getChainRowsForSupervisor,
  getDirectRowsForSupervisor,
} from "./rollupReport.groups.server";

import {
  buildSupervisorRow,
  rankRows,
} from "./rollupReport.rows.server";

function getDefinitionOrder(payload: MetricsSurfacePayload): string[] {
  const runtimeDefs = payload.executive_strip?.runtime?.definitions ?? [];

  if (runtimeDefs.length) {
    return runtimeDefs
      .map((definition: any) => String(definition.kpi_key ?? "").trim())
      .filter(Boolean);
  }

  return (payload.team_table.columns ?? [])
    .map((column) => String(column.kpi_key ?? "").trim())
    .filter(Boolean);
}

function getVisibleKpiKeys(args: {
  payload: MetricsSurfacePayload;
  class_type: "NSR" | "SMART";
}) {
  const ordered = getDefinitionOrder(args.payload);
  const limit = args.class_type === "SMART" ? 7 : 4;
  return ordered.slice(0, limit);
}

function getBpCompanies(rows: TeamRowClient[]) {
  const map = new Map<string, TeamRowClient[]>();

  for (const row of rows) {
    const isBp =
      String(row.affiliation_type ?? "").trim().toUpperCase() === "CONTRACTOR";

    if (!isBp) continue;

    const companyName = String(row.contractor_name ?? "").trim();
    if (!companyName) continue;

    if (!map.has(companyName)) map.set(companyName, []);
    map.get(companyName)!.push(row);
  }

  return [...map.entries()].map(([company_name, rows]) => ({
    company_name,
    rows,
  }));
}

export function buildRollupReportPayload(args: {
  payload: MetricsSurfacePayload;
  class_type: "NSR" | "SMART";
  range: "FM" | "PREVIOUS" | "3FM" | "12FM";
}) {
  const { payload, class_type, range } = args;

  const allRows = mapTeamRows(payload);
  const supervisors = getUniqueSupervisors(allRows);
  const visibleKpiKeys = getVisibleKpiKeys({ payload, class_type });

  const chainRows: any[] = [];
  const directRows: any[] = [];

  for (const supervisor of supervisors) {
    const chain = buildSupervisorRow({
      payload,
      supervisor,
      rows: getChainRowsForSupervisor({ payload, rows: allRows, supervisor }),
      visibleKpiKeys,
    });

    if (chain) chainRows.push(chain);

    const direct = buildSupervisorRow({
      payload,
      supervisor,
      rows: getDirectRowsForSupervisor({ rows: allRows, supervisor }),
      visibleKpiKeys,
    });

    if (direct) directRows.push(direct);
  }

  const bpCompanyRows = getBpCompanies(allRows)
    .map((company) =>
      buildSupervisorRow({
        payload,
        supervisor: {
          supervisor_person_id: company.company_name,
          supervisor_name: company.company_name,
        },
        rows: company.rows,
        visibleKpiKeys,
      })
    )
    .filter(Boolean);

  return {
    header: {
      generated_at: new Date().toISOString(),
      class_type,
      range,
      org_display: payload.header.org_display,
    },
    segments: {
      itg_supervisors: rankRows(
        chainRows.filter((row) =>
          directRows.some(
            (direct) =>
              direct.supervisor_person_id === row.supervisor_person_id &&
              direct.team_class === "ITG"
          )
        )
      ),
      bp_companies: rankRows(bpCompanyRows as any[]),
      all_supervisors: rankRows(directRows),
    },
  };
}