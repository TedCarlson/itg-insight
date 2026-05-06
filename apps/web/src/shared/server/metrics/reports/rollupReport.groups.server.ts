// path: apps/web/src/shared/server/metrics/reports/rollupReport.groups.server.ts

import type { TeamRowClient } from "@/shared/lib/metrics/buildScopedRows";
import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";

export type RollupTeamClass = "ITG" | "BP";

type SupervisorIdentity = {
  full_name: string | null;
  team_class: RollupTeamClass | null;
  role_type: string | null;
  position_title: string | null;
};

type RowWithChain = TeamRowClient & {
  supervisor_chain_person_ids?: unknown;
  team_class?: RollupTeamClass | null;
  reports_to_team_class?: RollupTeamClass | null;
  reports_to_role_type?: string | null;
  reports_to_position_title?: string | null;
  supervisor_identity_by_person_id?: Record<string, SupervisorIdentity>;
};

export type SupervisorOption = {
  supervisor_person_id: string;
  supervisor_name: string;
  team_class: RollupTeamClass | null;
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

export function getRowTeamClass(
  row: TeamRowClient
): RollupTeamClass | null {
  const unsafe = row as RowWithChain;

  const explicit = cleanString(unsafe.team_class)?.toUpperCase();

  if (explicit === "ITG" || explicit === "BP") {
    return explicit;
  }

  const affiliation = cleanString(row.affiliation_type)?.toUpperCase();

  if (affiliation === "COMPANY") return "ITG";
  if (affiliation === "CONTRACTOR") return "BP";

  return null;
}

function isItgLeadershipIdentity(identity: SupervisorIdentity | null) {
  if (!identity) return false;

  if (identity.team_class !== "ITG") {
    return false;
  }

  const roleType = String(identity.role_type ?? "")
    .trim()
    .toUpperCase();

  return roleType === "LEADERSHIP";
}

function buildSupervisorLabelMap(rows: TeamRowClient[]) {
  const map = new Map<string, string>();

  for (const row of rows) {
    const directId = getDirectSupervisorId(row);
    const directLabel = getDirectSupervisorLabel(row);

    if (directId && directLabel && !map.has(directId)) {
      map.set(directId, directLabel);
    }

    const unsafe = row as RowWithChain;

    for (const [personId, identity] of Object.entries(
      unsafe.supervisor_identity_by_person_id ?? {}
    )) {
      if (!personId || map.has(personId)) continue;

      const fullName = normalizeLeaderName(identity.full_name);

      if (fullName) {
        map.set(personId, fullName);
      }
    }
  }

  return map;
}

function buildSupervisorIdentityMap(rows: TeamRowClient[]) {
  const map = new Map<string, SupervisorIdentity>();

  for (const row of rows) {
    const unsafe = row as RowWithChain;

    const directId = getDirectSupervisorId(row);

    if (directId && !map.has(directId)) {
      map.set(directId, {
        full_name: getDirectSupervisorLabel(row),
        team_class: unsafe.reports_to_team_class ?? null,
        role_type: unsafe.reports_to_role_type ?? null,
        position_title: unsafe.reports_to_position_title ?? null,
      });
    }

    for (const [personId, identity] of Object.entries(
      unsafe.supervisor_identity_by_person_id ?? {}
    )) {
      if (!personId || map.has(personId)) continue;

      map.set(personId, {
        full_name: identity.full_name ?? null,
        team_class: identity.team_class ?? null,
        role_type: identity.role_type ?? null,
        position_title: identity.position_title ?? null,
      });
    }
  }

  return map;
}

function resolveSupervisorTeamClass(args: {
  supervisorId: string;
  supervisorIdentityById: Map<string, SupervisorIdentity>;
}) {
  const identity =
    args.supervisorIdentityById.get(args.supervisorId) ?? null;

  /*
   * IMPORTANT:
   * We classify the supervisor from WORKFORCE LEADERSHIP identity,
   * NOT from the affiliation of child metric rows.
   *
   * This fixes:
   *
   * Luke (ITG leadership)
   *   -> Byron (BP supervisor)
   *      -> BP techs
   *
   * Luke must remain ITG even though all descendant rows are BP.
   */

  if (isItgLeadershipIdentity(identity)) {
    return "ITG";
  }

  if (identity?.team_class === "BP") {
    return "BP";
  }

  return null;
}

export function getUniqueSupervisors(
  rows: TeamRowClient[]
): SupervisorOption[] {
  const labelMap = buildSupervisorLabelMap(rows);
  const supervisorIdentityById = buildSupervisorIdentityMap(rows);

  const ids = new Set<string>();

  for (const row of rows) {
    const direct = getDirectSupervisorId(row);

    if (direct) {
      ids.add(direct);
    }

    for (const id of getSupervisorChainIds(row)) {
      if (id) {
        ids.add(id);
      }
    }
  }

  return [...ids]
    .map((id) => {
      const identity =
        supervisorIdentityById.get(id) ?? null;

      const label =
        labelMap.get(id) ??
        normalizeLeaderName(identity?.full_name) ??
        null;

      if (!label) {
        return null;
      }

      return {
        supervisor_person_id: id,
        supervisor_name: label,
        team_class: resolveSupervisorTeamClass({
          supervisorId: id,
          supervisorIdentityById,
        }),
      };
    })
    .filter((x): x is SupervisorOption => !!x)
    .sort((a, b) =>
      a.supervisor_name.localeCompare(b.supervisor_name)
    );
}

function isDirectReportTo(
  row: TeamRowClient,
  supervisorId: string
) {
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
    isDirectReportTo(
      row,
      args.supervisor.supervisor_person_id
    )
  );
}