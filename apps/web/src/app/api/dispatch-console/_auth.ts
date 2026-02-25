import { supabaseServer } from "@/shared/data/supabase/server";
import { bootstrapProfileServer } from "@/shared/lib/auth/bootstrapProfile.server";

async function rpcBoolWithFallback(supabase: any, fn: string, auth_user_id?: string): Promise<boolean> {
  const apiClient: any = (supabase as any).schema ? (supabase as any).schema("api") : supabase;

  const attempts =
    fn === "is_owner"
      ? [{}]
      : [{ p_auth_user_id: auth_user_id }, { auth_user_id }];

  for (const args of attempts) {
    const { data, error } = await apiClient.rpc(fn, args);
    if (error) return false;
    return Boolean(data);
  }

  return false;
}

export async function requireDispatchConsoleAccess() {
  const sb = await supabaseServer();
  const boot = await bootstrapProfileServer();

  if (!boot.ok || !boot.auth_user_id) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const [isOwner, isItg, isBp] = await Promise.all([
    rpcBoolWithFallback(sb, "is_owner"),
    rpcBoolWithFallback(sb, "is_itg_supervisor", boot.auth_user_id),
    rpcBoolWithFallback(sb, "is_bp_supervisor", boot.auth_user_id),
  ]);

  if (!isOwner && !isItg && !isBp) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden (requires Owner, ITG Supervisor+, or BP Supervisor+)",
    };
  }

  return {
    ok: true as const,
    status: 200,
    supabase: sb,
    boot,
    access: { isOwner, isItg, isBp },
  };
}