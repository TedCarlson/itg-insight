// path: apps/web/src/shared/server/executive/buildDailyScheduleStatus.server.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type ExecutiveDailyScheduleScopeRow = {
  assignment_id: string | null;
  pc_org_id: string | null;
  tech_id: string | null;
};

export type ExecutiveDailyScheduleStatusOrgRow = {
  pc_org_id: string;
  org_label: string;

  hc: number;
  scheduled: number;
  sv: number;
  util_pct: number | null;

  call_outs: number | null;
};

export type ExecutiveDailyScheduleStatusPayload = {
  today_iso: string;

  total_hc: number;
  total_scheduled: number;
  total_sv: number;
  total_util_pct: number | null;

  call_outs: number | null;

  rows_by_org: ExecutiveDailyScheduleStatusOrgRow[];
};

type BuildDailyScheduleStatusArgs = {
  coveredOrgIds: string[];
  orgLabels: Map<string, string>;
  scopedAssignments: ExecutiveDailyScheduleScopeRow[];
};

type ScheduleDayFactRow = {
  pc_org_id: string | null;
  assignment_id: string | null;
  shift_date: string | null;
};

type ShiftValidationRow = {
  pc_org_id: string | null;
  tech_num: string | null;
  shift_date: string | null;
  is_work: boolean | null;
  is_bplow: boolean | null;
  is_prjt: boolean | null;
};

function todayInNY() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function pct(numer: number, denom: number) {
  if (denom <= 0) return null;
  return Math.round((numer / denom) * 100);
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export async function buildDailyScheduleStatus(
  args: BuildDailyScheduleStatusArgs,
): Promise<ExecutiveDailyScheduleStatusPayload> {
  const today = todayInNY();
  const admin = supabaseAdmin();

  const hcByOrg = new Map<string, number>();
  const assignmentIdsByOrg = new Map<string, Set<string>>();
  const techIdsByOrg = new Map<string, Set<string>>();

  for (const orgId of args.coveredOrgIds) {
    hcByOrg.set(orgId, 0);
    assignmentIdsByOrg.set(orgId, new Set<string>());
    techIdsByOrg.set(orgId, new Set<string>());
  }

  for (const row of args.scopedAssignments) {
    const orgId = clean(row.pc_org_id);
    const assignmentId = clean(row.assignment_id);
    const techId = clean(row.tech_id);

    if (!orgId) continue;

    increment(hcByOrg, orgId);

    if (assignmentId) {
      const set = assignmentIdsByOrg.get(orgId) ?? new Set<string>();
      set.add(assignmentId);
      assignmentIdsByOrg.set(orgId, set);
    }

    if (techId) {
      const set = techIdsByOrg.get(orgId) ?? new Set<string>();
      set.add(techId);
      techIdsByOrg.set(orgId, set);
    }
  }

  const assignmentIds = Array.from(
    new Set(
      args.scopedAssignments
        .map((row) => clean(row.assignment_id))
        .filter(Boolean),
    ),
  );

  const techIds = Array.from(
    new Set(
      args.scopedAssignments
        .map((row) => clean(row.tech_id))
        .filter(Boolean),
    ),
  );

  const scheduledByOrg = new Map<string, Set<string>>();
  const svByOrg = new Map<string, Set<string>>();

  if (assignmentIds.length) {
    const { data, error } = await admin
      .from("schedule_day_fact")
      .select("pc_org_id,assignment_id,shift_date")
      .in("assignment_id", assignmentIds)
      .eq("shift_date", today);

    if (error) {
      throw new Error(`Daily schedule status lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as ScheduleDayFactRow[]) {
      const orgId = clean(row.pc_org_id);
      const assignmentId = clean(row.assignment_id);

      if (!orgId || !assignmentId) continue;

      const set = scheduledByOrg.get(orgId) ?? new Set<string>();
      set.add(assignmentId);
      scheduledByOrg.set(orgId, set);
    }
  }

  if (techIds.length) {
    const { data, error } = await admin
      .from("shift_validation_row")
      .select("pc_org_id,tech_num,shift_date,is_work,is_bplow,is_prjt")
      .in("tech_num", techIds)
      .eq("shift_date", today);

    if (error) {
      throw new Error(`Daily shift validation lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as ShiftValidationRow[]) {
      const orgId = clean(row.pc_org_id);
      const techId = clean(row.tech_num);

      const validated =
        row.is_work === true ||
        row.is_bplow === true ||
        row.is_prjt === true;

      if (!orgId || !techId || !validated) continue;

      const set = svByOrg.get(orgId) ?? new Set<string>();
      set.add(techId);
      svByOrg.set(orgId, set);
    }
  }

  const rowsByOrg = args.coveredOrgIds
    .map((orgId) => {
      const hc = hcByOrg.get(orgId) ?? 0;
      const scheduled = scheduledByOrg.get(orgId)?.size ?? 0;
      const sv = svByOrg.get(orgId)?.size ?? 0;

      return {
        pc_org_id: orgId,
        org_label: args.orgLabels.get(orgId) ?? "Org",

        hc,
        scheduled,
        sv,
        util_pct: pct(sv || scheduled, hc),

        call_outs: null,
      };
    })
    .sort((a, b) => a.org_label.localeCompare(b.org_label));

  const totalHc = rowsByOrg.reduce((sum, row) => sum + row.hc, 0);
  const totalScheduled = rowsByOrg.reduce(
    (sum, row) => sum + row.scheduled,
    0,
  );
  const totalSv = rowsByOrg.reduce((sum, row) => sum + row.sv, 0);

  return {
    today_iso: today,

    total_hc: totalHc,
    total_scheduled: totalScheduled,
    total_sv: totalSv,
    total_util_pct: pct(totalSv || totalScheduled, totalHc),

    call_outs: null,

    rows_by_org: rowsByOrg,
  };
}

export default buildDailyScheduleStatus;