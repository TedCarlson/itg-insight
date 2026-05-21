import type { HomeWidgetPayload } from "@/shared/widgets/contracts/widget.types";

export async function buildRouteLockSnapshot(): Promise<
  HomeWidgetPayload["route_lock_snapshot"]
> {
  return {
    title: "Route Lock",
    headline: "Route readiness",
    subhead: "Quota, eligible routes, planned coverage, and lock risk.",
    items: [
      {
        label: "Quota",
        value: "—",
        note: "Pending quota wiring",
        tone: "neutral",
      },
      {
        label: "Eligible",
        value: "—",
        note: "Pending route-lock sweep",
        tone: "neutral",
      },
      {
        label: "Planned",
        value: "—",
        note: "Pending schedule wiring",
        tone: "neutral",
      },
      {
        label: "Risk",
        value: "—",
        note: "Pending lock verdict logic",
        tone: "warn",
      },
    ],
    alerts: [
      {
        id: "route-lock-risk-ready",
        label: "Route risk signal ready",
        detail: "This widget will surface quota, planned coverage, and route-lock readiness.",
        tone: "warn",
      },
    ],
    links: [
      {
        label: "Open Route Lock",
        href: "/route-lock",
        description: "Open schedule, quota, and route planning.",
      },
    ],
  };
}
