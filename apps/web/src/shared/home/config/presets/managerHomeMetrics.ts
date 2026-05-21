import type { HomeLayoutConfig } from "../../contracts/home.types";

export const managerHomeMetrics: HomeLayoutConfig = {
  id: "manager-metrics",
  role: "COMPANY_MANAGER",
  label: "Metrics Workspace",

  sections: [
    {
      id: "metrics-primary",

      title: "Metrics",

      widgets: [
        {
          id: "metrics",
          kind: "metrics_snapshot",
          title: "Metrics",
          size: "wide",
          zone: "main",
        },
      ],
    },

    {
      id: "operations",

      title: "Operations",

      widgets: [
        {
          id: "route-lock",
          kind: "route_lock_snapshot",
          title: "Route Lock",
          size: "medium",
          zone: "main",
        },

        {
          id: "dispatch",
          kind: "dispatch_snapshot",
          title: "Dispatch",
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
          size: "rail_half",
          zone: "rail",
        },
      ],
    },
  ],
};
