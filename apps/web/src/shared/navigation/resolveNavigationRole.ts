// path: apps/web/src/shared/navigation/resolveNavigationRole.ts

import type { AppRole } from "./types";

const LAST_SCOPED_ROLE_KEY = "to_last_scoped_role";

function isAppRole(value: unknown): value is AppRole {
  return (
    value === "APP_OWNER" ||
    value === "ADMIN" ||
    value === "DIRECTOR" ||
    value === "TECH" ||
    value === "ITG_SUPERVISOR" ||
    value === "COMPANY_MANAGER" ||
    value === "BP_SUPERVISOR" ||
    value === "BP_LEAD" ||
    value === "BP_OWNER" ||
    value === "UNSCOPED" ||
    value === "UNKNOWN"
  );
}

export function readShellRoleHint(): AppRole | null {
  if (typeof document === "undefined") return null;

  const el = document.getElementById("shell-role-hint");
  const role = el?.getAttribute("data-shell-role");

  return isAppRole(role) ? role : null;
}

export function readLastScopedRole(): AppRole | null {
  if (typeof window === "undefined") return null;

  try {
    const role = window.localStorage.getItem(LAST_SCOPED_ROLE_KEY);
    return isAppRole(role) ? role : null;
  } catch {
    return null;
  }
}

export function persistLastScopedRole(role: AppRole | null) {
  if (typeof window === "undefined") return;
  if (!role || role === "UNKNOWN" || role === "UNSCOPED") return;

  try {
    window.localStorage.setItem(LAST_SCOPED_ROLE_KEY, role);
  } catch {
    // ignore
  }
}

export function resolveNavigationRole(args: {
  pathname: string;
  lob: "FULFILLMENT" | "LOCATE";
  shellRoleHint?: AppRole | null;
  persistedRole?: AppRole | null;
  isOwner?: boolean;
  isAdmin?: boolean;
}): AppRole {
  if (args.lob === "LOCATE") return "UNKNOWN";

  if (args.isOwner) return "APP_OWNER";
  if (args.isAdmin) return "ADMIN";

  if (args.pathname === "/director" || args.pathname.startsWith("/director/")) {
    return "DIRECTOR";
  }

  if (args.pathname === "/bp-owner" || args.pathname.startsWith("/bp-owner/")) {
    return "BP_OWNER";
  }

  if (
    args.pathname === "/bp-supervisor" ||
    args.pathname.startsWith("/bp-supervisor/")
  ) {
    return "BP_SUPERVISOR";
  }

  if (args.pathname === "/bp-lead" || args.pathname.startsWith("/bp-lead/")) {
    return "BP_LEAD";
  }

  if (
    args.pathname === "/company-supervisor" ||
    args.pathname.startsWith("/company-supervisor/")
  ) {
    return "ITG_SUPERVISOR";
  }

  if (
    args.pathname === "/company-manager" ||
    args.pathname.startsWith("/company-manager/")
  ) {
    return "COMPANY_MANAGER";
  }

  if (args.pathname === "/tech" || args.pathname.startsWith("/tech/")) {
    return "TECH";
  }

  if (args.pathname === "/admin" || args.pathname.startsWith("/admin/")) {
    return "ADMIN";
  }

  if (args.shellRoleHint && args.shellRoleHint !== "UNKNOWN") {
    return args.shellRoleHint;
  }

  if (args.persistedRole && args.persistedRole !== "UNKNOWN") {
    return args.persistedRole;
  }

  return "UNKNOWN";
}