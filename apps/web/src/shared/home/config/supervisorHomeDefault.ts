import type { HomeLayoutConfig } from "../contracts/home.types";

export const supervisorHomeDefault: HomeLayoutConfig = {
  id: "itg-supervisor-default",
  label: "Supervisor Home",
  role: "ITG_SUPERVISOR",
  sections: [
    {
      id: "operating",
      title: "Today’s Operating Snapshot",
      description: "Daily supervisor operating signals.",
      widgets: [
        { id: "dispatch", kind: "dispatch_snapshot", title: "Dispatch Signal", size: "md" },
        { id: "route-lock", kind: "route_lock_snapshot", title: "Route Lock", size: "md" },
      ],
    },
    {
      id: "performance",
      title: "Team Performance",
      description: "Supervisor KPI signals for the selected org.",
      widgets: [
        { id: "metrics", kind: "metrics_snapshot", title: "Metrics Snapshot", size: "wide" },
      ],
    },
    {
      id: "actions",
      title: "Actions",
      widgets: [
        { id: "quick-actions", kind: "quick_actions", title: "Quick Actions", size: "wide" },
      ],
    },
  ],
};
