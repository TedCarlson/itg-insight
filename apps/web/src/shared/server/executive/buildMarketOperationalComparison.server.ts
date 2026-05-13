// path: apps/web/src/features/role-bp-owner/lib/buildBpOwnerMarketComparison.server.ts

type WorkforceSourceRow = {
  pc_org_id: string | null;
  pc_org_name?: string | null;

  role_type?: string | null;
  position_title?: string | null;

  is_active?: boolean | null;
  is_travel_tech?: boolean | null;

  has_schedule?: boolean | null;
};

export type MarketOperationalComparisonRow = {
  pc_org_id: string;
  pc_org_name: string;

  active_hc: number;
  field_hc: number;
  leadership_hc: number;
  training_hc: number;

  scheduled_hc: number;
  unscheduled_hc: number;

  travel_hc: number;

  status: "HEALTHY" | "WATCH" | "UNDER_PRESSURE";
};

type BuildBpOwnerMarketComparisonArgs = {
  workforceRows: WorkforceSourceRow[];
};

function isActive(row: WorkforceSourceRow) {
  return row.is_active === true;
}

function isField(row: WorkforceSourceRow) {
  const role = (row.role_type ?? "").toUpperCase();
  const title = (row.position_title ?? "").toUpperCase();

  return (
    role.includes("FIELD") ||
    title.includes("TECH") ||
    title.includes("TECHNICIAN")
  );
}

function isLeadership(row: WorkforceSourceRow) {
  const role = (row.role_type ?? "").toUpperCase();
  const title = (row.position_title ?? "").toUpperCase();

  return (
    role.includes("LEAD") ||
    role.includes("SUPERVISOR") ||
    title.includes("MANAGER") ||
    title.includes("SUPERVISOR")
  );
}

function isTraining(row: WorkforceSourceRow) {
  const role = (row.role_type ?? "").toUpperCase();
  const title = (row.position_title ?? "").toUpperCase();

  return (
    role.includes("TRAIN") ||
    title.includes("TRAIN")
  );
}

function isTravel(row: WorkforceSourceRow) {
  return row.is_travel_tech === true;
}

function isScheduled(row: WorkforceSourceRow) {
  return row.has_schedule === true;
}

function deriveStatus(args: {
  active_hc: number;
  unscheduled_hc: number;
  training_hc: number;
}) {
  const {
    active_hc,
    unscheduled_hc,
    training_hc,
  } = args;

  if (active_hc <= 0) {
    return "UNDER_PRESSURE" as const;
  }

  const unscheduledRate =
    active_hc > 0
      ? unscheduled_hc / active_hc
      : 0;

  const trainingRate =
    active_hc > 0
      ? training_hc / active_hc
      : 0;

  if (
    unscheduledRate >= 0.15 ||
    trainingRate >= 0.25
  ) {
    return "UNDER_PRESSURE" as const;
  }

  if (
    unscheduledRate >= 0.08 ||
    trainingRate >= 0.15
  ) {
    return "WATCH" as const;
  }

  return "HEALTHY" as const;
}

export function buildBpOwnerMarketComparison({
  workforceRows,
}: BuildBpOwnerMarketComparisonArgs): MarketOperationalComparisonRow[] {
  const grouped = new Map<string, WorkforceSourceRow[]>();

  for (const row of workforceRows) {
    const pcOrgId =
      row.pc_org_id ??
      "unknown";

    const existing =
      grouped.get(pcOrgId) ?? [];

    existing.push(row);

    grouped.set(pcOrgId, existing);
  }

  const out: MarketOperationalComparisonRow[] = [];

  for (const [pcOrgId, rows] of grouped.entries()) {
    const activeRows =
      rows.filter(isActive);

    const active_hc =
      activeRows.length;

    const field_hc =
      activeRows.filter(isField).length;

    const leadership_hc =
      activeRows.filter(isLeadership).length;

    const training_hc =
      activeRows.filter(isTraining).length;

    const scheduled_hc =
      activeRows.filter(isScheduled).length;

    const unscheduled_hc =
      Math.max(
        active_hc - scheduled_hc,
        0,
      );

    const travel_hc =
      activeRows.filter(isTravel).length;

    const pc_org_name =
      rows.find((r) => r.pc_org_name)?.pc_org_name ??
      "Unknown Market";

    out.push({
      pc_org_id: pcOrgId,
      pc_org_name,

      active_hc,
      field_hc,
      leadership_hc,
      training_hc,

      scheduled_hc,
      unscheduled_hc,

      travel_hc,

      status: deriveStatus({
        active_hc,
        unscheduled_hc,
        training_hc,
      }),
    });
  }

  return out.sort((a, b) =>
    a.pc_org_name.localeCompare(
      b.pc_org_name,
    ),
  );
}