import type { HomeLayoutConfig } from "../../contracts/home.types";

export const managerHomeOperations: HomeLayoutConfig = {
  id: "manager-operations",
  role: "COMPANY_MANAGER",
  label: "Operations Workspace",

  sections: [
    {
      id: "operations-primary",

      title: "Operations",

      widgets: [
        {
          id: "route-lock",
          kind: "route_lock_snapshot",
          title: "Route Lock",
          size: "wide",
          zone: "main",
        },

        {
          id: "dispatch",
          kind: "dispatch_snapshot",
          title: "Dispatch",
          size: "wide",
          zone: "main",
        },
      ],
    },

    {
      id: "performance",

      title: "Performance",

      widgets: [
        {
          id: "metrics",
          kind: "metrics_snapshot",
          title: "Metrics",
          size: "medium",
          zone: "main",
        },
      ],
    },

    {
      id: "workforce",

      title: "Workforce",

      widgets: [
        {
          id: "workforce",
          kind: "workforce_snapshot",
          title: "Workforce",
          size: "medium",
          zone: "main",
        },
      ],
    },

    {
      id: "activity",

      title: "Activity",

      widgets: [
        {
          id: "activity-feed",
          kind: "activity_feed",
          title: "Activity Feed",
          size: "rail_full",
          zone: "rail",
        },
      ],
    },
  ],
};
