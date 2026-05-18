import { PROFILE_ACCESS_PERMISSION_KEYS } from "./profileAccess.types";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

export async function listAuthUsers(admin: any) {
  return admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
}

export async function listProfiles(admin: any, authIds: string[]) {
  return admin
    .from("user_profile")
    .select("auth_user_id,person_id,core_person_id,status,is_admin,selected_pc_org_id")
    .in("auth_user_id", authIds.length ? authIds : [EMPTY_UUID]);
}

export async function listPcOrgs(admin: any) {
  return admin
    .from("pc_org")
    .select("pc_org_id,pc_org_name")
    .order("pc_org_name", { ascending: true })
    .limit(5000);
}

export async function listEligibility(admin: any, authIds: string[]) {
  return admin
    .from("user_pc_org_eligibility")
    .select("auth_user_id,pc_org_id,created_at")
    .in("auth_user_id", authIds.length ? authIds : [EMPTY_UUID]);
}

export async function listPermissionGrants(admin: any, authIds: string[]) {
  return admin
    .from("pc_org_permission_grant")
    .select("auth_user_id,pc_org_id,permission_key,expires_at,revoked_at")
    .in("auth_user_id", authIds.length ? authIds : [EMPTY_UUID])
    .in("permission_key", [...PROFILE_ACCESS_PERMISSION_KEYS]);
}

export async function listPeople(admin: any, personIds: string[]) {
  return admin
    .from("person")
    .select("person_id,full_name,emails,active")
    .in("person_id", personIds);
}

export async function profileExists(admin: any, authUserId: string) {
  return admin
    .from("user_profile")
    .select("auth_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
}

export async function pcOrgExists(admin: any, pcOrgId: string) {
  return admin
    .from("pc_org")
    .select("pc_org_id")
    .eq("pc_org_id", pcOrgId)
    .maybeSingle();
}

export async function grantOrgAccess(admin: any, authUserId: string, pcOrgId: string) {
  return admin
    .from("user_pc_org_eligibility")
    .upsert(
      { auth_user_id: authUserId, pc_org_id: pcOrgId },
      { onConflict: "auth_user_id,pc_org_id" },
    );
}

export async function revokeOrgAccess(admin: any, authUserId: string, pcOrgId: string) {
  return admin
    .from("user_pc_org_eligibility")
    .delete()
    .eq("auth_user_id", authUserId)
    .eq("pc_org_id", pcOrgId);
}

export async function getSelectedOrg(admin: any, authUserId: string) {
  return admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
}

export async function setSelectedOrg(admin: any, authUserId: string, pcOrgId: string | null) {
  return admin
    .from("user_profile")
    .update({
      selected_pc_org_id: pcOrgId,
      updated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", authUserId);
}

export async function getEligibility(admin: any, authUserId: string, pcOrgId: string) {
  return admin
    .from("user_pc_org_eligibility")
    .select("auth_user_id")
    .eq("auth_user_id", authUserId)
    .eq("pc_org_id", pcOrgId)
    .maybeSingle();
}

export async function enablePermission(
  admin: any,
  actorAuthUserId: string,
  authUserId: string,
  pcOrgId: string,
  permissionKey: string,
) {
  return admin
    .from("pc_org_permission_grant")
    .upsert(
      {
        pc_org_id: pcOrgId,
        auth_user_id: authUserId,
        permission_key: permissionKey,
        created_by: actorAuthUserId,
        revoked_at: null,
        revoked_by: null,
      },
      { onConflict: "pc_org_id,auth_user_id,permission_key" },
    );
}

export async function disablePermission(
  admin: any,
  actorAuthUserId: string,
  authUserId: string,
  pcOrgId: string,
  permissionKey: string,
) {
  return admin
    .from("pc_org_permission_grant")
    .update({ revoked_at: new Date().toISOString(), revoked_by: actorAuthUserId })
    .eq("pc_org_id", pcOrgId)
    .eq("auth_user_id", authUserId)
    .eq("permission_key", permissionKey)
    .is("revoked_at", null);
}
