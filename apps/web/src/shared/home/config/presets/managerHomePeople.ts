import type { HomeLayoutConfig } from "../../contracts/home.types";

export const managerHomePeople: HomeLayoutConfig = {
  id: "manager-people",
  role: "COMPANY_MANAGER",
  label: "People Workspace",

  sections: [
    {
      id: "workforce-primary",

      title: "Workforce",

      widgets: [
        {
          id: "workforce",
          kind: "workforce_snapshot",
          title: "Workforce",
          size: "wide",
          zone: "main",
        },
      ],
    },

    {
      id: "metrics",

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
