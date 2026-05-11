// path: apps/web/src/features/admin/access-health/lib/buildHealthRow.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type {
  AssignmentHealthRow,
  GrantHealthRow,
  HealthWarning,
  UserAccessHealthRow,
} from "./accessHealthTypes";
import { bool, clean } from "./accessHealthUtils";
import { loadPcOrgLabels } from "./loadPcOrgLabels";
import { resolveRoleFromAssignments } from "./resolveAccessHealthRole";

export async function buildHealthRow(args: {
  auth_user_id: string;
  email: string | null;
  last_sign_in_at: string | null;
}): Promise<UserAccessHealthRow> {
  const admin = supabaseAdmin();
  const warnings: HealthWarning[] = [];

  const { data: profile } = await admin
    .from("user_profile")
    .select(
      "auth_user_id, person_id, core_person_id, status, is_admin, selected_pc_org_id"
    )
    .eq("auth_user_id", args.auth_user_id)
    .maybeSingle();

  if (!profile) warnings.push("missing_user_profile");
  if (profile && profile.status !== "active") warnings.push("profile_not_active");

  const legacyPersonId = clean((profile as any)?.person_id);
  const corePersonId = clean((profile as any)?.core_person_id);
  const effectivePersonId = corePersonId ?? legacyPersonId;
  const selectedPcOrgId = clean((profile as any)?.selected_pc_org_id);

  if (!effectivePersonId) warnings.push("missing_person_link");
  if (!selectedPcOrgId) warnings.push("missing_selected_org");

  const { data: person } = effectivePersonId
    ? await admin
        .from("v_person_core")
        .select("person_id, full_name, emails, active, co_ref_id, co_code, role")
        .eq("person_id", effectivePersonId)
        .maybeSingle()
    : { data: null as any };

  const { data: membershipsRaw } = effectivePersonId
    ? await admin
        .from("person_pc_org")
        .select("person_id, pc_org_id")
        .eq("person_id", effectivePersonId)
    : { data: [] as any[] };

  const membershipPcOrgIds = (membershipsRaw ?? [])
    .map((row: any) => clean(row.pc_org_id))
    .filter(Boolean) as string[];

  if (
    selectedPcOrgId &&
    membershipPcOrgIds.length > 0 &&
    !membershipPcOrgIds.includes(selectedPcOrgId)
  ) {
    warnings.push("selected_org_not_in_person_memberships");
  }

  const pcOrgLabelMap = await loadPcOrgLabels(
    [selectedPcOrgId, ...membershipPcOrgIds].filter(Boolean) as string[]
  );

  const selectedOrg = selectedPcOrgId
    ? pcOrgLabelMap.get(selectedPcOrgId) ?? null
    : null;

  const memberships = (membershipsRaw ?? []).map((row: any) => {
    const pcOrgId = clean(row.pc_org_id);
    const label = pcOrgId ? pcOrgLabelMap.get(pcOrgId) : null;

    return {
      person_id: clean(row.person_id),
      pc_org_id: pcOrgId,
      pc_org_name: label?.pc_org_name ?? null,
    };
  });

  const { data: legacyAssignmentsRaw } =
    effectivePersonId && selectedPcOrgId
      ? await admin
          .from("assignment_admin_v")
          .select(
            "assignment_id, person_id, pc_org_id, tech_id, position_title, active, start_date, end_date"
          )
          .eq("person_id", effectivePersonId)
          .eq("pc_org_id", selectedPcOrgId)
      : { data: [] as any[] };

  const legacyAssignments: AssignmentHealthRow[] = (
    legacyAssignmentsRaw ?? []
  ).map((row: any) => ({
    source: "legacy",
    assignment_id: clean(row.assignment_id),
    person_id: clean(row.person_id),
    pc_org_id: clean(row.pc_org_id),
    tech_id: clean(row.tech_id),
    position_title: clean(row.position_title),
    active:
      row.active === null || row.active === undefined ? null : bool(row.active),
    start_date: clean(row.start_date),
    end_date: clean(row.end_date),
  }));

  if (effectivePersonId && selectedPcOrgId && legacyAssignments.length === 0) {
    warnings.push("no_legacy_assignment_in_selected_org");
  }

  const { data: profileFactsRaw } =
    effectivePersonId && selectedPcOrgId
      ? await admin
          .from("company_profile_fact")
          .select(
            "person_id, pc_org_id, tech_id, position_title, role_type, active_flag, effective_start_date, effective_end_date"
          )
          .eq("person_id", effectivePersonId)
          .eq("pc_org_id", selectedPcOrgId)
          .is("effective_end_date", null)
      : { data: [] as any[] };

  const coreAssignments: AssignmentHealthRow[] = (profileFactsRaw ?? []).map(
    (row: any) => ({
      source: "core",
      assignment_id: null,
      person_id: clean(row.person_id),
      pc_org_id: clean(row.pc_org_id),
      workspace_id: null,
      tech_id: clean(row.tech_id),
      position_title: clean(row.position_title),
      role_type: clean(row.role_type),
      assignment_status: row.active_flag === true ? "active" : "inactive",
      active:
        row.active_flag === null || row.active_flag === undefined
          ? null
          : bool(row.active_flag),
      start_date: clean(row.effective_start_date),
      end_date: clean(row.effective_end_date),
    })
  );

  if (effectivePersonId && selectedPcOrgId && coreAssignments.length === 0) {
    warnings.push("no_core_assignment_in_selected_org");
  }

  const { data: grantsRaw } = selectedPcOrgId
    ? await admin
        .from("pc_org_permission_grant")
        .select("pc_org_id, permission_key, expires_at, revoked_at")
        .eq("auth_user_id", args.auth_user_id)
        .eq("pc_org_id", selectedPcOrgId)
    : { data: [] as any[] };

  const grantsSelectedOrg: GrantHealthRow[] = (grantsRaw ?? []).map(
    (row: any) => ({
      pc_org_id: clean(row.pc_org_id),
      permission_key: clean(row.permission_key),
      expires_at: clean(row.expires_at),
      revoked_at: clean(row.revoked_at),
    })
  );

  const activeGrants = grantsSelectedOrg.filter((row) => !row.revoked_at);

  if (selectedPcOrgId && activeGrants.length === 0) {
    warnings.push("no_permission_grants_in_selected_org");
  }

  const activeLegacyAssignments = legacyAssignments.filter(
    (row) => row.active === true
  );

  const activeCoreAssignments = coreAssignments.filter(
    (row) => row.active === true
  );

  const resolved = resolveRoleFromAssignments([
    ...activeCoreAssignments,
    ...activeLegacyAssignments,
  ]);

  if (resolved.role_key === "UNKNOWN") warnings.push("role_not_resolved");

  return {
    auth_user_id: args.auth_user_id,
    email: args.email,
    last_sign_in_at: args.last_sign_in_at,

    profile: {
      exists: Boolean(profile),
      status: clean((profile as any)?.status),
      person_id: legacyPersonId,
      core_person_id: corePersonId,
      effective_person_id: effectivePersonId,
      selected_pc_org_id: selectedPcOrgId,
      is_admin: bool((profile as any)?.is_admin),
    },

    person: {
      exists: Boolean(person),
      person_id: clean((person as any)?.person_id),
      full_name: clean((person as any)?.full_name),
      emails: clean((person as any)?.emails),
      active:
        (person as any)?.active === null || (person as any)?.active === undefined
          ? null
          : bool((person as any)?.active),
      co_ref_id: clean((person as any)?.co_ref_id),
      co_code: clean((person as any)?.co_code),
      role: clean((person as any)?.role),
    },

    selected_org: {
      pc_org_id: selectedPcOrgId,
      pc_org_name: selectedOrg?.pc_org_name ?? null,
      region_id: selectedOrg?.region_id ?? null,
    },

    memberships,

    assignments: {
      legacy_selected_org: legacyAssignments,
      core_selected_org: coreAssignments,
    },

    grants_selected_org: grantsSelectedOrg,
    resolved,

    health: {
      ok: warnings.length === 0,
      warnings,
    },
  };
}