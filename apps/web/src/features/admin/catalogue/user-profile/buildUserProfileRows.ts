// path: apps/web/src/features/admin/catalogue/user-profile/buildUserProfileRows.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { clean, type UserProfileRow } from "./userProfileApiTypes";

export async function buildUserProfileRows(): Promise<{
  rows: UserProfileRow[];
  error?: string;
}> {
  const admin = supabaseAdmin();

  const profRes = await admin
    .from("user_profile")
    .select(
      "auth_user_id, person_id, core_person_id, status, selected_pc_org_id, is_admin, created_at, updated_at"
    )
    .limit(5000);

  if (profRes.error) {
    return { rows: [], error: profRes.error.message };
  }

  const profiles = (profRes.data ?? []) as Array<{
    auth_user_id: string;
    person_id: string | null;
    core_person_id: string | null;
    status: string | null;
    selected_pc_org_id: string | null;
    is_admin: boolean | null;
    created_at: string | null;
    updated_at: string | null;
  }>;

  const corePersonIds = Array.from(
    new Set(
      profiles
        .map((profile) => profile.core_person_id ?? profile.person_id)
        .map(clean)
        .filter(Boolean)
    )
  ) as string[];

  const pcOrgIds = Array.from(
    new Set(
      profiles
        .map((profile) => profile.selected_pc_org_id)
        .map(clean)
        .filter(Boolean)
    )
  ) as string[];

  const [usersRes, corePeopleRes, orgRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    corePersonIds.length
      ? admin
          .from("v_person_core")
          .select("person_id, full_name")
          .in("person_id", corePersonIds)
      : Promise.resolve({ data: [], error: null } as any),
    pcOrgIds.length
      ? admin
          .from("pc_org")
          .select("pc_org_id, pc_org_name")
          .in("pc_org_id", pcOrgIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (corePeopleRes?.error) {
    return { rows: [], error: corePeopleRes.error.message };
  }

  if (orgRes?.error) {
    return { rows: [], error: orgRes.error.message };
  }

  const emailByAuth = new Map<string, string | null>();

  for (const user of usersRes?.data?.users ?? []) {
    emailByAuth.set(String(user.id), (user.email ?? null) as string | null);
  }

  const nameByCorePerson = new Map<string, string | null>();

  for (const person of corePeopleRes?.data ?? []) {
    nameByCorePerson.set(
      String((person as any).person_id),
      ((person as any).full_name ?? null) as string | null
    );
  }

  const orgById = new Map<string, string | null>();

  for (const org of orgRes?.data ?? []) {
    orgById.set(
      String((org as any).pc_org_id),
      ((org as any).pc_org_name ?? null) as string | null
    );
  }

  const rows: UserProfileRow[] = profiles.map((profile) => {
    const effectiveCorePersonId = clean(
      profile.core_person_id ?? profile.person_id
    );

    return {
      auth_user_id: String(profile.auth_user_id),
      email: emailByAuth.get(String(profile.auth_user_id)) ?? null,

      person_id: effectiveCorePersonId,
      person_full_name: effectiveCorePersonId
        ? nameByCorePerson.get(effectiveCorePersonId) ?? null
        : null,

      core_person_id: effectiveCorePersonId,
      core_person_full_name: effectiveCorePersonId
        ? nameByCorePerson.get(effectiveCorePersonId) ?? null
        : null,

      legacy_person_id: clean(profile.person_id),

      status: profile.status ?? null,
      selected_pc_org_id: clean(profile.selected_pc_org_id),
      selected_pc_org_name: profile.selected_pc_org_id
        ? orgById.get(String(profile.selected_pc_org_id)) ?? null
        : null,
      is_admin: profile.is_admin === true,
      created_at: profile.created_at ?? null,
      updated_at: profile.updated_at ?? null,
    };
  });

  rows.sort((a, b) => {
    const aTs = a.updated_at ?? a.created_at ?? "";
    const bTs = b.updated_at ?? b.created_at ?? "";
    return bTs.localeCompare(aTs);
  });

  return { rows };
}