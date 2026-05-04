// path: apps/web/src/lib/nav/buildRoleNav.ts

export type AppRole =
  | "TECH"
  | "ITG_SUPERVISOR"
  | "COMPANY_MANAGER"
  | "BP_SUPERVISOR"
  | "BP_LEAD"
  | "BP_OWNER"
  | "UNKNOWN";

export type RoleNavItem = {
  key: string;
  label: string;
  href: string;
};

export function buildRoleNav(role: AppRole): RoleNavItem[] {
  if (role === "TECH") {
    return [
      { key: "home", label: "Home", href: "/home" },
      { key: "metrics", label: "Metrics", href: "/tech/metrics" },
      { key: "schedule", label: "Schedule", href: "/tech/schedule" },
      { key: "dispatch", label: "Dispatch Console", href: "/dispatch-console" },
      { key: "fieldlog", label: "Field Log", href: "/tech/field-log" },
    ];
  }

  if (role === "ITG_SUPERVISOR") {
    return [
      { key: "home", label: "Home", href: "/home" },
      { key: "metrics", label: "Metrics", href: "/company-supervisor/metrics" },
      { key: "workforce", label: "Workforce", href: "/company-supervisor/workforce" },
      { key: "people", label: "People", href: "/company-supervisor/people" },
      { key: "dispatch", label: "Dispatch Console", href: "/dispatch-console" },
      { key: "fieldlog", label: "Field Log", href: "/field-log" },
    ];
  }

  if (role === "COMPANY_MANAGER") {
    return [
      { key: "home", label: "Home", href: "/home" },
      { key: "metrics", label: "Metrics", href: "/company-manager/metrics" },
      { key: "workforce", label: "Workforce", href: "/company-manager/workforce" },
      { key: "people", label: "People", href: "/company-manager/people" },
      { key: "routelock", label: "Route Lock", href: "/route-lock" },
      { key: "dispatch", label: "Dispatch Console", href: "/dispatch-console" },
      { key: "fieldlog", label: "Field Log", href: "/field-log" },
    ];
  }

  if (role === "BP_SUPERVISOR") {
    return [
      { key: "home", label: "Home", href: "/home" },
      { key: "metrics", label: "Metrics", href: "/bp-supervisor/metrics" },
      { key: "dispatch", label: "Dispatch Console", href: "/dispatch-console" },
      { key: "fieldlog", label: "Field Log", href: "/field-log" },
    ];
  }

  if (role === "BP_LEAD") {
    return [
      { key: "home", label: "Home", href: "/home" },
      { key: "metrics", label: "Metrics", href: "/bp-supervisor/metrics" },
      { key: "dispatch", label: "Dispatch Console", href: "/dispatch-console" },
      { key: "fieldlog", label: "Field Log", href: "/field-log" },
    ];
  }

  if (role === "BP_OWNER") {
    return [
      { key: "home", label: "Home", href: "/home" },
      { key: "metrics", label: "Metrics", href: "/bp-supervisor/metrics" },
      { key: "dispatch", label: "Dispatch Console", href: "/dispatch-console" },
      { key: "fieldlog", label: "Field Log", href: "/field-log" },
    ];
  }

  return [{ key: "home", label: "Home", href: "/home" }];
}