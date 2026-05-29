export const PROFILE_ACCESS_PERMISSION_KEYS = [
  "roster_manage",
  "route_lock_manage",
  "schedule_exception_submit",
  "metrics_manage",
  "dispatch_manage",
] as const;

export type ProfileAccessPermissionKey =
  (typeof PROFILE_ACCESS_PERMISSION_KEYS)[number];

export type ProfileAccessAction =
  | "grant_org_access"
  | "revoke_org_access"
  | "set_selected_org"
  | "toggle_permission";

export type ProfileAccessMutationInput = {
  action: ProfileAccessAction;
  auth_user_id: string;
  pc_org_id?: string | null;
  permission_key?: string | null;
  enabled?: boolean;
};

export type ProfileAccessQueryInput = {
  q: string;
  limit: number;
};
