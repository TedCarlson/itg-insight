// path: apps/web/src/features/role-bp-owner/lib/getBpOwnerOverviewPayload.server.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { resolveBpOwnerScope } from "./resolveBpOwnerScope.server";

export type BpOwnerRoleBreakoutRow = {
  pc_org_id: string;
  org_label: string;
  active_people: number;
  bp_owner_count: number;
  bp_supervisor_count: number;
  tech_count: number;
  other_count: number;
};

export type BpOwnerOverviewPayload = {
  contractor_id: string | null;
  contractor_name: string | null;

  selected_pc_org_id: string;
  covered_pc_org_ids: string[];

  workforce_count: number;
  active_org_count: number;

  role_breakout_by_org: BpOwnerRoleBreakoutRow[];

  metrics: {
    scoped: true;
  };
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function classifyRole(positionTitle: string | null | undefined) {
  const title = clean(positionTitle).toLowerCase();

  if (title === "bp owner") return "bp_owner";
  if (title === "bp supervisor" || title === "bp lead") return "bp_supervisor";
  if (title === "technician" || title === "tech") return "tech";

  return "other";
}

async function loadOrgLabels(pcOrgIds: string[]) {
  if (!pcOrgIds.length) return new Map<string, string>();

  const admin = supabaseAdmin();

  const { data } = await admin
    .from("pc_org")
    .select("pc_org_id, pc_org_name")
    .in("pc_org_id", pcOrgIds);

  return new Map(
    (data ?? []).map((row) => [
      clean((row as any).pc_org_id),
      clean((row as any).pc_org_name) || "Org",
    ])
  );
}

export async function getBpOwnerOverviewPayload(): Promise<BpOwnerOverviewPayload> {
  const resolved = await resolveBpOwnerScope();

  const coveredOrgIds = resolved.covered_pc_org_ids;
  const orgLabels = await loadOrgLabels(coveredOrgIds);

  const breakoutMap = new Map<string, BpOwnerRoleBreakoutRow>();

  for (const orgId of coveredOrgIds) {
    breakoutMap.set(orgId, {
      pc_org_id: orgId,
      org_label: orgLabels.get(orgId) ?? "Org",
      active_people: 0,
      bp_owner_count: 0,
      bp_supervisor_count: 0,
      tech_count: 0,
      other_count: 0,
    });
  }

  for (const row of resolved.scoped_assignments) {
    const orgId = clean(row.pc_org_id);
    if (!orgId) continue;

    const current =
      breakoutMap.get(orgId) ??
      {
        pc_org_id: orgId,
        org_label: orgLabels.get(orgId) ?? "Org",
        active_people: 0,
        bp_owner_count: 0,
        bp_supervisor_count: 0,
        tech_count: 0,
        other_count: 0,
      };

    current.active_people += 1;

    const role = classifyRole(row.position_title);

    if (role === "bp_owner") current.bp_owner_count += 1;
    else if (role === "bp_supervisor") current.bp_supervisor_count += 1;
    else if (role === "tech") current.tech_count += 1;
    else current.other_count += 1;

    breakoutMap.set(orgId, current);
  }

  const roleBreakout = [...breakoutMap.values()].sort((a, b) =>
    a.org_label.localeCompare(b.org_label)
  );

  return {
    contractor_id: resolved.contractor_id,
    contractor_name: resolved.contractor_name,

    selected_pc_org_id: resolved.selected_pc_org_id,
    covered_pc_org_ids: coveredOrgIds,

    workforce_count: resolved.scoped_assignments.length,
    active_org_count: coveredOrgIds.length,

    role_breakout_by_org: roleBreakout,

    metrics: {
      scoped: true,
    },
  };
}

export default getBpOwnerOverviewPayload;