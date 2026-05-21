import type { HomeWidgetPayload } from "@/shared/widgets/contracts/widget.types";

export async function buildActivityFeed(): Promise<
  HomeWidgetPayload["activity_feed"]
> {
  return {
    title: "Activity Feed",

    items: [
      {
        id: "dispatch-alert",
        label: "Dispatch operating signal",
        detail: "Call outs and route movement events will surface here.",
        tone: "warn",
      },
      {
        id: "metrics-alert",
        label: "Metrics checkpoint ready",
        detail: "Selected KPI movement and threshold alerts will appear here.",
        tone: "good",
      },
      {
        id: "workforce-alert",
        label: "Workforce review queue",
        detail: "Profile mismatch, onboarding, and access review items will surface here.",
        tone: "warn",
      },
      {
        id: "route-lock-alert",
        label: "Route readiness stream",
        detail: "Quota risk and lock-readiness exceptions will surface here.",
        tone: "neutral",
      },
    ],
  };
}
