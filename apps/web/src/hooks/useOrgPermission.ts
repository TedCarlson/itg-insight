/**
 * IMPORTANT:
 * UI gating must be in-memory only.
 * Server-side enforcement still happens via RLS / secure RPC.
 */
"use client";

import { useMemo } from "react";
import { useOrg } from "@/state/org";
import { useAccessPass } from "@/state/access";

type Result = {
  loading: boolean;
  allowed: boolean;
  error: string | null;
};

export function useOrgPermission(permissionKey: string): Result {
  const { selectedOrgId } = useOrg();
  const { accessPass } = useAccessPass();

  const allowed = useMemo(() => {
    if (!selectedOrgId) return false;
    const perms = accessPass?.permissions ?? [];
    return perms.includes(permissionKey);
  }, [selectedOrgId, accessPass, permissionKey]);

  // "loading" means: org is selected but pass not hydrated yet
  const loading = !!selectedOrgId && !accessPass;

  return { loading, allowed, error: null };
}