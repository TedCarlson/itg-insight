"use client";

import { useOrgPermission } from "@/hooks/useOrgPermission";

export function useRosterManageAccess() {
  return useOrgPermission("roster_manage");
}