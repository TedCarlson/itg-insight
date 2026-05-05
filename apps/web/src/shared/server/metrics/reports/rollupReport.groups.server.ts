// path: apps/web/src/shared/server/metrics/reports/rollupReport.groups.server.ts

import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";
import type { TeamRowClient } from "@/shared/lib/metrics/buildScopedRows";

export type RollupTeamClass = "ITG" | "BP";

type RowWithChain = TeamRowClient & {
  supervisor_chain_person_ids?: unknown;
  team_class?: RollupTeamClass | null;
};

type SupervisorOption = {
  supervisor_person_id: string;
  supervisor_name: string;
};

function cleanString(value: unknown) {
  const next = String(value ?? "").trim();
  return next ? next : null;
}

function normalizeLeaderName(value: unknown) {
  const text = cleanString(value);
  if (!text) return null;
  return text.split("•")[0]?.trim() || text;
}

function normalizeChain(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function getDirectSupervisorId(row: TeamRowClient) {
  return cleanString(row.reports_to_person_id);
}

function getDirectSupervisorLabel(row: TeamRowClient) {
  return normalizeLeaderName(row.reports_to_label);
}

export function getSupervisorChainIds(row: TeamRowClient) {
  const unsafe = row as RowWithChain;
  const directId = getDirectSupervisorId(row);
  const chain = normalizeChain(unsafe.supervisor_chain_person_ids);

  if (directId && !chain.includes(directId)) {
    return [directId, ...chain];
  }
  return chain;
}

export function getRowTeamClass(row: TeamRowClient): RollupTeamClass | null {
  const unsafe = row as RowWithChain;
  const explicit = cleanString(unsafe.team_class)?.toUpperCase();

  if (explicit === "ITG" || explicit === "BP") return explicit;

  const affiliation = cleanString(row.affiliation_type)?.toUpperCase();
  if (affiliation === "COMPANY") return "ITG";
  if (affiliation === "CONTRACTOR") return "BP";

  return null;
}

function buildSupervisorLabelMap(rows: TeamRowClient[]) {
  const map = new Map<string, string>();

  for (const row of rows) {
    const id = getDirectSupervisorId(row);
    const label = getDirectSupervisorLabel(row);
    if (id && label && !map.has(id)) map.set(id, label);
  }

  return map;
}

export function getUniqueSupervisors(rows: TeamRowClient[]): SupervisorOption[] {
  const labelMap = buildSupervisorLabelMap(rows);
  const ids = new Set<string>();

  for (const row of rows) {
    const direct = getDirectSupervisorId(row);
    if (direct) ids.add(direct);

    for (const id of getSupervisorChainIds(row)) {
      if (id) ids.add(id);
    }
  }

  return [...ids]
    .map((id) => {
      const label = labelMap.get(id);
      if (!label) return null;
      return { supervisor_person_id: id, supervisor_name: label };
    })
    .filter((x): x is SupervisorOption => !!x)
    .sort((a, b) => a.supervisor_name.localeCompare(b.supervisor_name));
}

function isDirectReportTo(row: TeamRowClient, supervisorId: string) {
  return getDirectSupervisorId(row) === supervisorId;
}

export function getChainRowsForSupervisor(args: {
  payload: MetricsSurfacePayload;
  rows: TeamRowClient[];
  supervisor: SupervisorOption;
}) {
  const id = args.supervisor.supervisor_person_id;

  return args.rows.filter((row) =>
    getSupervisorChainIds(row).includes(id)
  );
}

export function getDirectRowsForSupervisor(args: {
  rows: TeamRowClient[];
  supervisor: SupervisorOption;
}) {
  return args.rows.filter((row) =>
    isDirectReportTo(row, args.supervisor.supervisor_person_id)
  );
}