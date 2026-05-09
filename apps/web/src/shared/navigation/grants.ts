// path: apps/web/src/shared/navigation/grants.ts

import type { GrantChip } from "@/components/navigation/GrantChipPill";

export function buildGrantChips(permissions: string[] | undefined): GrantChip[] {
  const perms = Array.isArray(permissions) ? permissions : [];
  const chips: GrantChip[] = [];

  if (perms.includes("roster_manage")) {
    chips.push({
      key: "RM",
      label: "RM",
      tooltip: "Roster Management",
    });
  }

  if (perms.includes("route_lock_manage")) {
    chips.push({
      key: "RL",
      label: "RL",
      tooltip: "Route Lock",
    });
  }

  if (perms.includes("metrics_manage")) {
    chips.push({
      key: "MM",
      label: "MM",
      tooltip: "Metrics Management",
    });
  }

  return chips;
}