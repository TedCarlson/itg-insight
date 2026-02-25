import type { OrgEventRow, PcOrgAdminMeta, PcOrgChoice } from "../types";
import type { ApiModuleCtx } from "./_ctx";

export async function pcOrgChoices(ctx: ApiModuleCtx): Promise<PcOrgChoice[]> {
  return (await ctx.rpcWithFallback<PcOrgChoice[]>("pc_org_choices", [undefined])) ?? [];
}

export async function pcOrgAdminMeta(ctx: ApiModuleCtx, pc_org_id: string): Promise<PcOrgAdminMeta> {
  const { data, error } = await ctx.supabase
    .from("pc_org_admin_v")
    .select("pc_org_id,mso_name,division_name,region_name")
    .eq("pc_org_id", pc_org_id)
    .maybeSingle();

  if (error) throw ctx.normalize(error);
  return (data as any) ?? { pc_org_id, mso_name: null, division_name: null, region_name: null };
}

export async function orgEventFeed(ctx: ApiModuleCtx, pc_org_id: string, limit = 50): Promise<OrgEventRow[]> {
  return (
    (await ctx.rpcWithFallback<OrgEventRow[]>("org_event_feed", [
      { p_pc_org_id: pc_org_id, p_limit: limit },
      { p_pc_org_id: pc_org_id, limit },
      { pc_org_id, limit },
    ])) ?? []
  );
}

export async function isItgSupervisor(ctx: ApiModuleCtx, auth_user_id: string): Promise<boolean> {
  const out = await ctx.rpcWithFallback<boolean>("is_itg_supervisor", [
    { p_auth_user_id: auth_user_id },
    { auth_user_id },
  ]);
  return !!out;
}

// BP supervisor access (mirrors ITG supervisor RPC shape). If the RPC is not
// deployed in the DB yet, rpcWithFallback will return null and we fail closed.
export async function isBpSupervisor(ctx: ApiModuleCtx, auth_user_id: string): Promise<boolean> {
  const out = await ctx.rpcWithFallback<boolean>("is_bp_supervisor", [
    { p_auth_user_id: auth_user_id },
    { auth_user_id },
  ]);
  return !!out;
}