// path: apps/web/src/shared/navigation/resolveNavigation.ts

import { ACCOUNT_NAVIGATION_ITEMS, NAVIGATION_REGISTRY } from "./registry";
import type {
  AppRole,
  NavigationItemDefinition,
  ResolveNavigationInput,
  ResolvedNavigation,
  ResolvedNavigationItem,
} from "./types";
import { isNavigationItemVisible } from "./visibility";

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function normalizeRole(role: AppRole): AppRole {
  return role || "UNKNOWN";
}

function workspaceHomeForRole(role: AppRole) {
  switch (role) {
    case "APP_OWNER":
    case "ADMIN":
      return "/admin";

    case "DIRECTOR":
      return "/director/executive";

    case "BP_OWNER":
      return "/bp-owner";

    case "BP_SUPERVISOR":
    case "BP_LEAD":
      return "/bp-supervisor/metrics";

    case "ITG_SUPERVISOR":
      return "/home";

    case "COMPANY_MANAGER":
      return "/home";

    case "TECH":
      return "/tech";

    case "UNSCOPED":
      return "/access";

    case "UNKNOWN":
    default:
      return "/home";
  }
}

function resolveItem(args: {
  item: NavigationItemDefinition;
  pathname: string;
}): ResolvedNavigationItem {
  return {
    key: args.item.key,
    label: args.item.label,
    href: args.item.href,
    icon: args.item.icon,
    description: args.item.description,
    active: isActivePath(args.pathname, args.item.href),
  };
}

function resolveItems(args: {
  items: NavigationItemDefinition[];
  input: ResolveNavigationInput;
}) {
  const role = normalizeRole(args.input.role);

  return args.items
    .filter((item) =>
      isNavigationItemVisible({
        item,
        role,
        isOwner: args.input.isOwner,
        isAdmin: args.input.isAdmin,
        permissions: args.input.permissions,
      })
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) =>
      resolveItem({
        item,
        pathname: args.input.pathname,
      })
    );
}

function shouldShowOrgSelector(role: AppRole) {
  return role !== "TECH";
}

function shouldShowLobSwitch(args: ResolveNavigationInput) {
  return Boolean(args.isOwner || args.role === "APP_OWNER");
}

function shouldShowAdmin(args: ResolveNavigationInput) {
  return Boolean(
    args.isOwner ||
      args.isAdmin ||
      args.role === "APP_OWNER" ||
      args.role === "ADMIN"
  );
}

export function resolveNavigation(input: ResolveNavigationInput): ResolvedNavigation {
  const role = normalizeRole(input.role);

  return {
    role,
    workspaceHomeHref: workspaceHomeForRole(role),
    showOrgSelector: shouldShowOrgSelector(role),
    showLobSwitch: shouldShowLobSwitch(input),
    showAdmin: shouldShowAdmin(input),
    railItems: resolveItems({
      items: NAVIGATION_REGISTRY,
      input: {
        ...input,
        role,
      },
    }),
    accountItems: resolveItems({
      items: ACCOUNT_NAVIGATION_ITEMS,
      input: {
        ...input,
        role,
      },
    }),
  };
}