import type { HomeLayoutConfig } from "../contracts/home.types";

export const bpSupervisorHomeDefault: HomeLayoutConfig = {
  id: "bp-supervisor-default",
  label: "BP Supervisor Home",
  role: "BP_SUPERVISOR",
  sections: [
    {
      id: "operating",
      title: "Today’s Operating Snapshot",
      description: "Daily operating signals for your assigned scope.",
      widgets: [
        {
          id: "dispatch",
          kind: "dispatch_snapshot",
          title: "Dispatch Signal",
          size: "medium",
        },
        {
          id: "route-lock",
          kind: "route_lock_snapshot",
          title: "Route Lock",
          size: "medium",
        },
      ],
    },
    {
      id: "performance",
      title: "Performance",
      description: "KPI signals for your assigned scope.",
      widgets: [
        {
          id: "metrics",
          kind: "metrics_snapshot",
          title: "Metrics Snapshot",
          size: "wide",
        },
      ],
    },
  ],
};
