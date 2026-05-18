import {
  PROFILE_ACCESS_PERMISSION_KEYS,
  type ProfileAccessMutationInput,
  type ProfileAccessQueryInput,
} from "./profileAccess.types";
import { mapProfileAccessRows } from "./profileAccess.mapper";
import * as repo from "./profileAccess.repository";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string) {
  return UUID_RE.test(String(v ?? "").trim());
}

function fail(error: string, status = 400) {
  return { ok: false as const, error, status };
}

export async function getProfileAccessPayload(admin: any, input: ProfileAccessQueryInput) {
  const usersRes = await repo.listAuthUsers(admin);
  if (usersRes.error) return fail(usersRes.error.message, 500);

  const authUsers = usersRes.data.users ?? [];
  const authIds = authUsers.map((u: any) => String(u.id)).filter(Boolean);

  const [profilesRes, orgsRes, eligRes, grantsRes] = await Promise.all([
    repo.listProfiles(admin, authIds),
    repo.listPcOrgs(admin),
    repo.listEligibility(admin, authIds),
    repo.listPermissionGrants(admin, authIds),
  ]);

  if (profilesRes.error) return fail(profilesRes.error.message, 500);
  if (orgsRes.error) return fail(orgsRes.error.message, 500);
  if (eligRes.error) return fail(eligRes.error.message, 500);
  if (grantsRes.error) return fail(grantsRes.error.message, 500);

  const personIds: string[] = Array.from(
    new Set<string>(
      (profilesRes.data ?? [])
        .map((p: any) => p.core_person_id ?? p.person_id)
        .filter(Boolean)
        .map(String),
    ),
  );

  let people: any[] = [];
  if (personIds.length) {
    const peopleRes = await repo.listPeople(admin, personIds);
    if (peopleRes.error) return fail(peopleRes.error.message, 500);
    people = peopleRes.data ?? [];
  }

  return {
    ok: true as const,
    status: 200,
    rows: mapProfileAccessRows({
      authUsers,
      profiles: profilesRes.data ?? [],
      pcOrgs: orgsRes.data ?? [],
      eligibility: eligRes.data ?? [],
      grants: grantsRes.data ?? [],
      people,
      q: input.q,
      limit: input.limit,
    }),
    pc_orgs: (orgsRes.data ?? []).map((o: any) => ({
      pc_org_id: String(o.pc_org_id),
      pc_org_name: o.pc_org_name ?? null,
    })),
    permission_keys: PROFILE_ACCESS_PERMISSION_KEYS,
  };
}

async function validateProfileAndOrg(admin: any, authUserId: string, pcOrgId?: string | null) {
  if (!authUserId || !isUuid(authUserId)) return fail("invalid_auth_user_id");

  const profileRes = await repo.profileExists(admin, authUserId);
  if (profileRes.error) return fail(profileRes.error.message, 500);
  if (!profileRes.data?.auth_user_id) return fail("missing_user_profile");

  if (pcOrgId !== undefined && pcOrgId !== null) {
    if (!isUuid(pcOrgId)) return fail("invalid_pc_org_id");

    const orgRes = await repo.pcOrgExists(admin, pcOrgId);
    if (orgRes.error) return fail(orgRes.error.message, 500);
    if (!orgRes.data?.pc_org_id) return fail("invalid_pc_org_id");
  }

  return { ok: true as const };
}

export async function mutateProfileAccess(admin: any, actorAuthUserId: string, input: ProfileAccessMutationInput) {
  const base = await validateProfileAndOrg(admin, input.auth_user_id, input.pc_org_id ?? null);
  if (!base.ok) return base;

  if (input.action === "grant_org_access") {
    if (!input.pc_org_id) return fail("invalid_pc_org_id");

    const res = await repo.grantOrgAccess(admin, input.auth_user_id, input.pc_org_id);
    if (res.error) return fail(res.error.message);
    return { ok: true as const, status: 200 };
  }

  if (input.action === "revoke_org_access") {
    if (!input.pc_org_id) return fail("invalid_pc_org_id");

    const res = await repo.revokeOrgAccess(admin, input.auth_user_id, input.pc_org_id);
    if (res.error) return fail(res.error.message);

    const selected = await repo.getSelectedOrg(admin, input.auth_user_id);
    if (!selected.error && String(selected.data?.selected_pc_org_id ?? "") === input.pc_org_id) {
      await repo.setSelectedOrg(admin, input.auth_user_id, null);
    }

    return { ok: true as const, status: 200 };
  }

  if (input.action === "set_selected_org") {
    if (!input.pc_org_id) return fail("invalid_pc_org_id");

    const elig = await repo.getEligibility(admin, input.auth_user_id, input.pc_org_id);
    if (elig.error) return fail(elig.error.message, 500);
    if (!elig.data?.auth_user_id) return fail("selected_org_must_be_eligible_first");

    const res = await repo.setSelectedOrg(admin, input.auth_user_id, input.pc_org_id);
    if (res.error) return fail(res.error.message);
    return { ok: true as const, status: 200 };
  }

  if (input.action === "toggle_permission") {
    if (!input.pc_org_id) return fail("invalid_pc_org_id");
    if (!input.permission_key || !PROFILE_ACCESS_PERMISSION_KEYS.includes(input.permission_key as any)) {
      return fail("invalid_permission_key");
    }

    const res = input.enabled
      ? await repo.enablePermission(
          admin,
          actorAuthUserId,
          input.auth_user_id,
          input.pc_org_id,
          input.permission_key,
        )
      : await repo.disablePermission(
          admin,
          actorAuthUserId,
          input.auth_user_id,
          input.pc_org_id,
          input.permission_key,
        );

    if (res.error) return fail(res.error.message);
    return { ok: true as const, status: 200 };
  }

  return fail("unknown_action");
}
