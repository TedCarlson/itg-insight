import type { HomeWidgetPayload } from "@/shared/widgets/contracts/widget.types";
import type { AppRole } from "@/shared/navigation/types";

export function buildQuickActions(
  role: AppRole,
): HomeWidgetPayload["quick_actions"] {
  const isSupervisor = role === "ITG_SUPERVISOR";

  return {
    title: "Quick Actions",
    actions: [
      {
        label: "Metrics",
        href: isSupervisor ? "/company-supervisor/metrics" : "/company-manager/metrics",
        description: "Open team performance reporting",
      },
      {
        label: "Workforce",
        href: isSupervisor ? "/company-supervisor/workforce" : "/company-manager/workforce",
        description: "Review active workforce and org structure",
      },
      {
        label: "People",
        href: isSupervisor ? "/company-supervisor/people" : "/company-manager/people",
        description: "Open people and onboarding surfaces",
      },
      {
        label: "Route Lock",
        href: "/route-lock",
        description: "Open schedule, quota, and route planning",
      },
      {
        label: "Dispatch Console",
        href: "/dispatch-console",
        description: "Open today’s dispatch operating console",
      },
      {
        label: "Field Log",
        href: "/field-log",
        description: "Open field activity logs",
      },
    ],
  };
}
