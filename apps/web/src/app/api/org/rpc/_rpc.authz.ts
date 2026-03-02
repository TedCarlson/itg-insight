// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/org/rpc/_rpc.authz.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type { RpcSchema } from "./_rpc.types";

export function makeServiceClient() {
  try {
    return supabaseAdmin();
  } catch {
    return null;
  }
}

export async function getSelectedPcOrgIdService(auth_user_id: string): Promise<string | null> {
  const svc = makeServiceClient();
  if (!svc) return null;

  const { data, error } = await svc
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", auth_user_id)
    .maybeSingle();

  if (error) return null;
  return (data?.selected_pc_org_id as string | null) ?? null;
}

export async function isOwnerUserClient(supabaseUser: any): Promise<boolean> {
  const { data, error } = await supabaseUser.rpc("is_owner");
  if (error) return false;
  return Boolean(data);
}

export async function hasAnyRoleService(auth_user_id: string, roleKeys: string[]): Promise<boolean> {
  const svc = makeServiceClient();
  if (!svc) return false;

  const { data, error } = await svc.from("user_roles").select("role_key").eq("auth_user_id", auth_user_id);
  if (error) return false;

  const roles = (data ?? []).map((r: any) => String(r?.role_key ?? "")).filter(Boolean);
  return roles.some((rk: string) => roleKeys.includes(rk));
}

export async function canAccessPcOrgUserClient(supabaseUser: any, pc_org_id: string): Promise<boolean> {
  const apiClient: any = (supabaseUser as any).schema ? (supabaseUser as any).schema("api") : supabaseUser;
  const { data, error } = await apiClient.rpc("can_access_pc_org", { p_pc_org_id: pc_org_id });
  if (error) return false;
  return Boolean(data);
}

export async function requirePermission(
  supabaseUser: any,
  pc_org_id: string,
  permission_key: string,
  opts?: { elevated?: boolean }
): Promise<boolean> {
  // Centralized bypass: owners/admin/dev/director/vp can pass without explicit pc_org_permission_grant rows.
  // Note: route.ts is still responsible for enforcing baseline org access for elevated users.
  if (opts?.elevated) return true;

  const apiClient: any = (supabaseUser as any).schema ? (supabaseUser as any).schema("api") : supabaseUser;
  const { data, error } = await apiClient.rpc("has_pc_org_permission", {
    p_pc_org_id: pc_org_id,
    p_permission_key: permission_key,
  });
  if (error) return false;
  return Boolean(data);
}

export function makeEnsureOrgScope(args: { rid: string; selectedPcOrgId: string | null; elevated: boolean }) {
  const { rid, selectedPcOrgId, elevated } = args;

  return function ensureOrgScope(targetPcOrgId: string, requiredSelected: boolean = true) {
    if (!targetPcOrgId) {
      return {
        ok: false as const,
        status: 400,
        body: { ok: false, request_id: rid, error: "Missing pc_org_id", code: "missing_pc_org_id" },
      };
    }

    if (requiredSelected && !selectedPcOrgId && !elevated) {
      return {
        ok: false as const,
        status: 409,
        body: { ok: false, request_id: rid, error: "No selected org", code: "no_selected_pc_org" },
      };
    }

    // Enforce org match for non-elevated users
    if (selectedPcOrgId && targetPcOrgId !== selectedPcOrgId && !elevated) {
      return {
        ok: false as const,
        status: 403,
        body: { ok: false, request_id: rid, error: "Forbidden (org mismatch)", code: "org_mismatch" },
      };
    }

    return { ok: true as const };
  };
}

export function withSchema(client: any, schema: RpcSchema) {
  return schema === "api" ? ((client as any).schema ? (client as any).schema("api") : client) : client;
}