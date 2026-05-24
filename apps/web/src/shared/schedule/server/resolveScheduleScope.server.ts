// path: apps/web/src/shared/schedule/server/resolveScheduleScope.server.ts

import {
  requireSelectedPcOrgServer,
} from "@/shared/lib/auth/requireSelectedPcOrg.server";

import {
  supabaseAdmin,
} from "@/shared/data/supabase/admin";

export type ScheduleScope =
  | "ALL_ORG"
  | "BP_CONTRACTOR"
  | "BP_SUPERVISOR"
  | "TECH_SELF";

export type ResolvedScheduleScope = {
  scope: ScheduleScope;

  allowedPcOrgIds: string[];

  contractorId: string | null;

  personId: string | null;

  assignmentIds: string[];
};

type WorkforceRoleRow = {
  assignment_id: string | null;
  person_id: string | null;
  pc_org_id: string | null;
  role_type: string | null;
  affiliation_id: string | null;
  affiliation_code: string | null;
  assignment_status: string | null;
  is_active: boolean | null;
};

type LeadershipEdgeRow = {
  parent_assignment_id: string | null;
  child_assignment_id: string | null;
  active: boolean | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeRole(value: unknown) {
  return clean(value).toUpperCase();
}

function buildChildrenByParent(edges: LeadershipEdgeRow[]) {
  const out = new Map<string, string[]>();

  for (const edge of edges) {
    if (edge.active !== true) {
      continue;
    }

    const parent =
      clean(edge.parent_assignment_id);

    const child =
      clean(edge.child_assignment_id);

    if (!parent || !child) {
      continue;
    }

    const existing =
      out.get(parent) ?? [];

    existing.push(child);

    out.set(parent, existing);
  }

  return out;
}

function collectDescendants(
  roots: string[],
  childrenByParent: Map<string, string[]>,
) {
  const out =
    new Set<string>();

  const stack =
    [...roots];

  while (stack.length) {
    const current =
      stack.pop();

    if (!current || out.has(current)) {
      continue;
    }

    out.add(current);

    for (const child of childrenByParent.get(current) ?? []) {
      stack.push(child);
    }
  }

  return out;
}

export async function resolveScheduleScope(args?: {
  forceScope?: "TECH_SELF" | null;
  forceAssignmentIds?: string[] | null;
}): Promise<ResolvedScheduleScope> {
  const selected =
    await requireSelectedPcOrgServer();

  if (!selected.ok) {
    return {
      scope: "ALL_ORG",
      allowedPcOrgIds: [],
      contractorId: null,
      personId: null,
      assignmentIds: [],
    };
  }

  const boot =
    selected.boot;

  const selectedPcOrgId =
    selected.selected_pc_org_id;

  const personId =
    clean(boot.person_id);

  if (!personId) {
    return {
      scope: "ALL_ORG",
      allowedPcOrgIds: [
        selectedPcOrgId,
      ],
      contractorId: null,
      personId: null,
      assignmentIds: [],
    };
  }

  if (args?.forceScope === "TECH_SELF") {
    const forcedAssignmentIds =
      (args.forceAssignmentIds ?? [])
        .map((value) => clean(value))
        .filter(Boolean);

    return {
      scope: "TECH_SELF",
      allowedPcOrgIds: [
        selectedPcOrgId,
      ],
      contractorId: null,
      personId,
      assignmentIds: forcedAssignmentIds,
    };
  }

  if (
    boot.is_owner ||
    boot.is_admin ||
    boot.is_app_owner
  ) {
    return {
      scope: "ALL_ORG",
      allowedPcOrgIds: [
        selectedPcOrgId,
      ],
      contractorId: null,
      personId,
      assignmentIds: [],
    };
  }

  const admin =
    supabaseAdmin();

  const { data: meRows, error: meError } =
    await admin
      .from("workforce_current_v")
      .select(
        [
          "assignment_id",
          "person_id",
          "pc_org_id",
          "role_type",
          "affiliation_id",
          "affiliation_code",
          "assignment_status",
          "is_active",
        ].join(","),
      )
      .eq("pc_org_id", selectedPcOrgId)
      .eq("person_id", personId)
      .eq("is_active", true)
      .eq("assignment_status", "active");

  if (meError) {
    throw new Error(
      `schedule scope user lookup failed: ${meError.message}`,
    );
  }

  const me =
    ((meRows ?? []) as unknown as WorkforceRoleRow[])
      .find((row) => clean(row.assignment_id))
    ?? null;

  const myAssignmentId =
    clean(me?.assignment_id);

  const contractorId =
    clean(me?.affiliation_id);

  const affiliationCode =
    normalizeRole(me?.affiliation_code);

  const role =
    normalizeRole(me?.role_type);

  if (
    role === "DIRECTOR" ||
    role === "ADMIN" ||
    role === "APP_OWNER" ||
    role === "ITG_SUPERVISOR" ||
    role === "COMPANY_MANAGER" ||
    affiliationCode === "ITG"
  ) {
    return {
      scope: "ALL_ORG",
      allowedPcOrgIds: [
        selectedPcOrgId,
      ],
      contractorId: null,
      personId,
      assignmentIds: [],
    };
  }

  if (
    contractorId &&
    affiliationCode &&
    affiliationCode !== "ITG"
  ) {
    return {
      scope: "BP_CONTRACTOR",
      allowedPcOrgIds: [
        selectedPcOrgId,
      ],
      contractorId,
      personId,
      assignmentIds: [],
    };
  }

  if (
    false &&
    myAssignmentId &&
    contractorId
  ) {
    const { data: workforceRows, error: workforceError } =
      await admin
        .from("workforce_current_v")
        .select(
          [
            "assignment_id",
            "person_id",
            "pc_org_id",
            "role_type",
            "affiliation_id",
            "assignment_status",
            "is_active",
          ].join(","),
        )
        .eq("pc_org_id", selectedPcOrgId)
        .eq("affiliation_id", contractorId)
        .eq("is_active", true)
        .eq("assignment_status", "active");

    if (workforceError) {
      throw new Error(
        `schedule scope workforce lookup failed: ${workforceError?.message ?? "unknown_error"}`,
      );
    }

    const workforce =
      ((workforceRows ?? []) as unknown as WorkforceRoleRow[]);

    const allAssignmentIds =
      workforce
        .map((row) => clean(row.assignment_id))
        .filter(Boolean);

    const { data: edgesRaw, error: edgesError } =
      await admin
        .from("assignment_leadership_admin_v")
        .select("parent_assignment_id,child_assignment_id,active")
        .in("parent_assignment_id", allAssignmentIds)
        .in("child_assignment_id", allAssignmentIds)
        .eq("active", true);

    if (edgesError) {
      throw new Error(
        `schedule scope leadership lookup failed: ${edgesError?.message ?? "unknown_error"}`,
      );
    }

    const descendants =
      collectDescendants(
        [myAssignmentId],
        buildChildrenByParent(
          (edgesRaw ?? []) as unknown as LeadershipEdgeRow[],
        ),
      );

    return {
      scope: "BP_SUPERVISOR",
      allowedPcOrgIds: [
        selectedPcOrgId,
      ],
      contractorId,
      personId,
      assignmentIds:
        Array.from(descendants),
    };
  }

  return {
    scope: "ALL_ORG",
    allowedPcOrgIds: [
      selectedPcOrgId,
    ],
    contractorId: null,
    personId,
    assignmentIds: [],
  };
}
