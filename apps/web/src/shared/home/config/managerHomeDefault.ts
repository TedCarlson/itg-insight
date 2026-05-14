import type { HomeLayoutConfig } from "../contracts/home.types";

export const managerHomeDefault: HomeLayoutConfig = {
  id: "company-manager-default",
  label: "Manager Home",
  role: "COMPANY_MANAGER",
  sections: [
    {
      id: "operating",
      title: "Today’s Operating Snapshot",
      description: "Daily coverage, route-lock, and dispatch signals.",
      widgets: [
        { id: "route-lock", kind: "route_lock_snapshot", title: "Route Lock", size: "md" },
        { id: "dispatch", kind: "dispatch_snapshot", title: "Dispatch Signal", size: "md" },
      ],
    },
    {
      id: "performance",
      title: "Team Performance",
      description: "Core manager KPI signals for the selected org.",
      widgets: [
        { id: "metrics", kind: "metrics_snapshot", title: "Metrics Snapshot", size: "wide" },
      ],
    },
    {
      id: "workforce",
      title: "Workforce",
      description: "People, coverage, and readiness signals.",
      widgets: [
        { id: "workforce", kind: "workforce_snapshot", title: "Workforce Snapshot", size: "md" },
        { id: "quick-actions", kind: "quick_actions", title: "Quick Actions", size: "md" },
      ],
    },
    {
      id: "activity",
      title: "Activity Feed",
      description: "Recent signals and operational notes.",
      widgets: [
        { id: "activity-feed", kind: "activity_feed", title: "Activity Feed", size: "wide" },
      ],
    },
  ],
};
