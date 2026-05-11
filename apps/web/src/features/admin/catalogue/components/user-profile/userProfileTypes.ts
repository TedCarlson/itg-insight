// path: apps/web/src/features/admin/catalogue/components/user-profile/userProfileTypes.ts

export type UserProfileRow = {
  auth_user_id: string;
  email: string | null;
  status: string | null;
  core_person_id?: string | null;
  core_person_full_name?: string | null;
  person_id?: string | null;
  person_full_name?: string | null;
  legacy_person_id?: string | null;
  selected_pc_org_id: string | null;
  selected_pc_org_name: string | null;
  is_admin: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PersonSearchRow = {
  person_id: string;
  full_name: string;
  emails: string | null;
  active: boolean;
  role?: string | null;
  co_code?: string | null;
  co_ref_id?: string | null;
};

export type PcOrgOption = {
  pc_org_id: string;
  pc_org_name: string | null;
};

export function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function fmtTs(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}