// path: apps/web/src/shared/navigation/mobile.ts

import type { ResolvedNavigationItem } from "./types";

export function buildMobileFooterItems(navItems: ResolvedNavigationItem[]) {
  const find = (key: ResolvedNavigationItem["key"]) =>
    navItems.find((item) => item.key === key);

  const items: Array<ResolvedNavigationItem & { mobileLabel?: string }> = [];

  const home =
    find("tech_home") ??
    find("bp_owner_overview") ??
    find("company_supervisor") ??
    find("company_manager") ??
    find("home");

  const metrics =
    find("tech_metrics") ??
    find("bp_owner_metrics") ??
    find("bp_supervisor_metrics") ??
    find("metrics");

  const workforce =
    find("bp_owner_workforce") ??
    find("workforce") ??
    find("company_supervisor") ??
    find("company_manager");

  const dispatch = find("dispatch_console");

  if (home) items.push(home);

  if (metrics) {
    items.push({
      ...metrics,
      mobileLabel: "Metrics",
    });
  }

  if (workforce) {
    items.push({
      ...workforce,
      mobileLabel: "Workforce",
    });
  }

  if (dispatch) {
    items.push({
      ...dispatch,
      mobileLabel: "Dispatch",
    });
  }

  return items.slice(0, 4);
}