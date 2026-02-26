"use client";

import { useMemo } from "react";
import { useOrg } from "@/state/org";
import { useAccessPass } from "@/state/access";

type Result = {
  loading: boolean;
  allowed: boolean;
  reason: string | null;
};

export function useDispatchConsoleAccess(): Result {
  const { selectedOrgId } = useOrg();
  const { accessPass } = useAccessPass();

  const loading = !!selectedOrgId && !accessPass;

  const allowed = useMemo(() => {
    if (!selectedOrgId) return false;
    const perms = accessPass?.permissions ?? [];
    return perms.includes("dispatch_manage");
  }, [selectedOrgId, accessPass]);

  const reason = !selectedOrgId
    ? "Select a PC scope first"
    : loading
      ? "Loading access…"
      : allowed
        ? null
        : "Supervisor access required";

  return { loading, allowed, reason };
}