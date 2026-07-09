// path: apps/web/src/features/admin/access-health/lib/resolveAccessHealthRole.ts

import type { AssignmentHealthRow } from "./accessHealthTypes";
import { clean } from "./accessHealthUtils";

export function resolveRoleFromAssignments(assignments: AssignmentHealthRow[]) {
  const titles = new Set(
    assignments
      .map((row) => clean(row.position_title))
      .filter(Boolean)
      .map((value) => String(value))
  );

  if (
    titles.has("Director") ||
    titles.has("Regional Director") ||
    titles.has("Senior Director")
  ) {
    return { role_key: "DIRECTOR", home_href: "/director/workspace" };
  }

  if (
    titles.has("Manager") ||
    titles.has("Project Manager") ||
    titles.has("Regional Manager")
  ) {
    return { role_key: "COMPANY_MANAGER", home_href: "/company-manager/metrics" };
  }

  if (titles.has("ITG Supervisor")) {
    return { role_key: "ITG_SUPERVISOR", home_href: "/company-supervisor/metrics" };
  }

  if (titles.has("BP Supervisor")) {
    return { role_key: "BP_SUPERVISOR", home_href: "/bp-supervisor/metrics" };
  }

  if (titles.has("BP Owner")) {
    return { role_key: "BP_OWNER", home_href: "/bp-owner" };
  }

  if (titles.has("BP Lead")) {
    return { role_key: "BP_LEAD", home_href: "/bp-supervisor/metrics" };
  }

  if (titles.has("Technician")) {
    return { role_key: "TECH", home_href: "/tech" };
  }

  return { role_key: "UNKNOWN", home_href: null };
}