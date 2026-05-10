// path: apps/web/src/shared/navigation/visibility.ts

import type {
  AppRole,
  NavigationItemDefinition,
  NavigationPermissionKey,
} from "./types";

function normalizePermissions(permissions: string[] | undefined) {
  return new Set((permissions ?? []).map((permission) => permission.trim()));
}

function hasAnyPermission(args: {
  permissionSet: Set<string>;
  permissions?: NavigationPermissionKey[];
}) {
  if (!args.permissions?.length) return false;
  return args.permissions.some((permission) => args.permissionSet.has(permission));
}

function hasAllPermissions(args: {
  permissionSet: Set<string>;
  permissions?: NavigationPermissionKey[];
}) {
  if (!args.permissions?.length) return true;
  return args.permissions.every((permission) => args.permissionSet.has(permission));
}

export function isNavigationItemVisible(args: {
  item: NavigationItemDefinition;
  role: AppRole;
  isOwner?: boolean;
  isAdmin?: boolean;
  permissions?: string[];
}) {
  const { item, role, isOwner, isAdmin, permissions } = args;

  if (item.visibility === "hidden") return false;

  const isPowerUser =
    Boolean(isOwner) || Boolean(isAdmin) || role === "APP_OWNER" || role === "ADMIN";

  const permissionSet = normalizePermissions(permissions);
  const isDefaultForRole = Boolean(item.defaultRoles?.includes(role));

  const exposedByGrant =
    isPowerUser ||
    hasAnyPermission({
      permissionSet,
      permissions: item.exposeWhenPermissions,
    });

  const passesAnyRequired =
    isPowerUser ||
    !item.requireAnyPermission?.length ||
    hasAnyPermission({
      permissionSet,
      permissions: item.requireAnyPermission,
    });

  const passesAllRequired =
    isPowerUser ||
    hasAllPermissions({
      permissionSet,
      permissions: item.requireAllPermissions,
    });

  if (!passesAnyRequired || !passesAllRequired) return false;

  if (item.visibility === "default") {
    if (item.defaultRoles?.length) {
      return isDefaultForRole;
    }

    return exposedByGrant;
  }

  if (item.visibility === "grant") {
    return exposedByGrant;
  }

  return false;
}