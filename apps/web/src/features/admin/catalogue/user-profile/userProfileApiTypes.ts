// path: apps/web/src/features/admin/catalogue/user-profile/userProfileApiTypes.ts

export type UserProfileRow = {
  auth_user_id: string;
  email: string | null;

  // UI-compatible alias now points to core.people
  person_id: string | null;
  person_full_name: string | null;

  core_person_id: string | null;
  core_person_full_name: string | null;

  // legacy compatibility only
  legacy_person_id: string | null;

  status: string | null;
  selected_pc_org_id: string | null;
  selected_pc_org_name: string | null;
  is_admin: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export function num(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clean(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next || null;
}