// path: apps/web/src/features/admin/access-health/lib/accessHealthTypes.ts

export type HealthWarning =
  | "missing_user_profile"
  | "profile_not_active"
  | "missing_person_link"
  | "missing_selected_org"
  | "selected_org_not_in_person_memberships"
  | "no_legacy_assignment_in_selected_org"
  | "no_core_assignment_in_selected_org"
  | "no_permission_grants_in_selected_org"
  | "role_not_resolved";

export type AssignmentHealthRow = {
  source: "legacy" | "core";
  assignment_id: string | null;
  person_id: string | null;
  pc_org_id: string | null;
  workspace_id?: string | null;
  tech_id: string | null;
  position_title: string | null;
  role_type?: string | null;
  assignment_status?: string | null;
  active: boolean | null;
  start_date: string | null;
  end_date: string | null;
};

export type GrantHealthRow = {
  pc_org_id: string | null;
  permission_key: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export type UserAccessHealthRow = {
  auth_user_id: string;
  email: string | null;
  last_sign_in_at: string | null;

  profile: {
    exists: boolean;
    status: string | null;
    person_id: string | null;
    core_person_id: string | null;
    effective_person_id: string | null;
    selected_pc_org_id: string | null;
    is_admin: boolean;
  };

  person: {
    exists: boolean;
    person_id: string | null;
    full_name: string | null;
    emails: string | null;
    active: boolean | null;
    co_ref_id: string | null;
    co_code: string | null;
    role: string | null;
  };

  selected_org: {
    pc_org_id: string | null;
    pc_org_name: string | null;
    region_id: string | null;
  };

  memberships: Array<{
    person_id: string | null;
    pc_org_id: string | null;
    pc_org_name: string | null;
  }>;

  assignments: {
    legacy_selected_org: AssignmentHealthRow[];
    core_selected_org: AssignmentHealthRow[];
  };

  grants_selected_org: GrantHealthRow[];

  resolved: {
    role_key: string;
    home_href: string | null;
  };

  health: {
    ok: boolean;
    warnings: HealthWarning[];
  };
};