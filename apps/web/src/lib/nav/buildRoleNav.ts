export type AppRole =
  | "TECH"
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
      { key: "metrics", label: "Tech Metrics", href: "/tech/metrics" },
      { key: "schedule", label: "Schedule", href: "/tech/schedule" },
      { key: "dispatch", label: "Dispatch Console", href: "/dispatch-console" },
      { key: "fieldlog", label: "Field Log", href: "/tech/field-log" },
    ];
  }

  if (
    role === "BP_SUPERVISOR" ||
    role === "BP_LEAD" ||
    role === "BP_OWNER"
  ) {
    return [
      { key: "home", label: "Home", href: "/home" },
      { key: "bpview", label: "BP View", href: "/bp/view" },
      { key: "dispatch", label: "Dispatch Console", href: "/dispatch-console" },
      { key: "fieldlog", label: "Field Log", href: "/field-log" },
    ];
  }

  return [{ key: "home", label: "Home", href: "/home" }];
}