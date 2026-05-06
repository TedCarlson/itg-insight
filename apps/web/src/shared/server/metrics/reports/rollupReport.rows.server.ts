// path: apps/web/src/shared/server/metrics/reports/rollupReport.rows.server.ts

import type { TeamRowClient } from "@/shared/lib/metrics/buildScopedRows";
import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";

import {
  buildKpis,
  computeComposite,
  readNumeric,
} from "./rollupReport.kpis.server";

import {
  getRowTeamClass,
  type RollupTeamClass,
  type SupervisorOption,
} from "./rollupReport.groups.server";

export type SupervisorRollupRow = {
  supervisor_person_id: string;
  supervisor_name: string;
  team_class: RollupTeamClass;
  rollup_hc: number;
  jobs: number;
  composite_score: number | null;
  rank: number | null;
  kpis: any[];
};

function cleanTechId(value: unknown): string | null {
  const text = String(value ?? "").trim();

  if (!text || text === "—" || text.startsWith("UNASSIGNED-")) {
    return null;
  }

  return text;
}

function getMetric(row: TeamRowClient, metricKey: string): any | null {
  return (
    (row.metrics ?? []).find(
      (metric: any) => metric.metric_key === metricKey
    ) ?? null
  );
}

function getRowJobCount(row: TeamRowClient): number {
  const ftrMetric = getMetric(row, "ftr_rate");
  return readNumeric(ftrMetric?.denominator) ?? 0;
}

function isEligibleRollupRow(row: TeamRowClient): boolean {
  const techId = cleanTechId(row.tech_id);

  if (!techId) return false;

  return getRowJobCount(row) > 0;
}

function getRollupHeadcount(rows: TeamRowClient[]): number {
  const techIds = new Set<string>();

  for (const row of rows) {
    if (!isEligibleRollupRow(row)) continue;

    const techId = cleanTechId(row.tech_id);

    if (techId) {
      techIds.add(techId);
    }
  }

  return techIds.size;
}

function getRollupJobs(rows: TeamRowClient[]): number {
  return rows.reduce((total, row) => {
    if (!isEligibleRollupRow(row)) return total;

    return total + getRowJobCount(row);
  }, 0);
}

function resolveRollupTeamClass(args: {
  supervisor: SupervisorOption;
  eligibleRows: TeamRowClient[];
}): RollupTeamClass {
  if (args.supervisor.team_class === "ITG") return "ITG";
  if (args.supervisor.team_class === "BP") return "BP";

  return getRowTeamClass(args.eligibleRows[0]) ?? "BP";
}

export function buildSupervisorRow(args: {
  payload: MetricsSurfacePayload;
  supervisor: SupervisorOption;
  rows: TeamRowClient[];
  visibleKpiKeys: string[];
}): SupervisorRollupRow | null {
  const eligibleRows = args.rows.filter(isEligibleRollupRow);

  if (!eligibleRows.length) {
    return null;
  }

  const kpis = buildKpis({
    payload: args.payload,
    rows: eligibleRows,
    visibleKpiKeys: args.visibleKpiKeys,
  });

  const compositeScore = computeComposite(kpis);

  return {
    supervisor_person_id: args.supervisor.supervisor_person_id,
    supervisor_name: args.supervisor.supervisor_name,
    team_class: resolveRollupTeamClass({
      supervisor: args.supervisor,
      eligibleRows,
    }),
    rollup_hc: getRollupHeadcount(eligibleRows),
    jobs: getRollupJobs(eligibleRows),
    composite_score: compositeScore,
    rank: null,
    kpis,
  };
}

export function rankRows(rows: SupervisorRollupRow[]) {
  const rankedRows = [...rows].sort((a, b) => {
    const aHasComposite = typeof a.composite_score === "number";
    const bHasComposite = typeof b.composite_score === "number";

    if (aHasComposite && bHasComposite) {
      const aScore = a.composite_score as number;
      const bScore = b.composite_score as number;

      if (bScore !== aScore) {
        return bScore - aScore;
      }

      return a.supervisor_name.localeCompare(b.supervisor_name);
    }

    if (aHasComposite) return -1;
    if (bHasComposite) return 1;

    return a.supervisor_name.localeCompare(b.supervisor_name);
  });

  let nextRank = 1;

  return rankedRows.map((row) => {
    if (typeof row.composite_score !== "number") {
      return {
        ...row,
        rank: null,
      };
    }

    return {
      ...row,
      rank: nextRank++,
    };
  });
}