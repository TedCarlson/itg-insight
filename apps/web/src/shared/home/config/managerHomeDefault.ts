import type { HomeLayoutConfig } from "../contracts/home.types";

export const managerHomeDefault: HomeLayoutConfig = {
  id: "company-manager-default",
  label: "Manager Home",
  role: "COMPANY_MANAGER",
  sections: [
    {
      id: "operating",
      title: "Today’s Operating Snapshot",
      description: "Daily route-lock coverage and dispatch signals.",
      widgets: [
        {
          id: "route-lock",
          kind: "route_lock_snapshot",
          title: "Route Lock",
          size: "medium",
        },
        {
          id: "dispatch",
          kind: "dispatch_snapshot",
          title: "Dispatch Signal",
          size: "medium",
        },
      ],
    },

    {
      id: "data-operations",
      title: "Data Operations",
      description: "Operational uploads and ingestion workflows.",
      widgets: [

      ],
    },

    {
      id: "performance",
      title: "Performance",
      description: "Manager KPI signals for the selected org.",
      widgets: [
        {
          id: "metrics",
          kind: "metrics_snapshot",
          title: "Metrics Snapshot",
          size: "wide",
        },
      ],
    },
    {
      id: "workforce",
      title: "Workforce",
      description: "People, coverage, and readiness signals.",
      widgets: [
        {
          id: "workforce",
          kind: "workforce_snapshot",
          title: "Workforce Snapshot",
          size: "wide",
        },
      ],
    },
    {
      id: "activity",
      title: "Activity",
      description: "Recent operational notes and system signals.",
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
