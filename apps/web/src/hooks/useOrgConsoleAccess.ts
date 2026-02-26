"use client";

import { useMemo } from "react";
import { useOrg } from "@/state/org";
import { useAccessPass } from "@/state/access";

type Result = {
  loading: boolean;
  canManageConsole: boolean;
  error: string | null;
};

export function useOrgConsoleAccess(): Result {
  const { selectedOrgId } = useOrg();
  const { accessPass } = useAccessPass();

  const loading = !!selectedOrgId && !accessPass;

  const canManageConsole = useMemo(() => {
    if (!selectedOrgId) return false;
    if (accessPass?.is_app_owner || accessPass?.is_admin) return true;
    const perms = accessPass?.permissions ?? [];
    // If you later add a dedicated permission key, wire it here.
    return perms.includes("org_console_manage") || perms.includes("admin_console_manage");
  }, [selectedOrgId, accessPass]);

  return { loading, canManageConsole, error: null };
}