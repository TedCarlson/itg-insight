import type { HomeWidgetPayload } from "../contracts/widget.types";
import type { HomeSurfacePayload } from "../contracts/home.types";
import { resolveHomeLayout } from "../config/homeRegistry";
import { loadHomeUserContext } from "./loadHomeUserContext.server";
import { buildActivityFeed } from "./widgets/buildActivityFeed.server";
import { buildDispatchSnapshot } from "./widgets/buildDispatchSnapshot.server";
import { buildMetricsSnapshot } from "./widgets/buildMetricsSnapshot.server";
import { buildRouteLockSnapshot } from "./widgets/buildRouteLockSnapshot.server";
import { buildWorkforceSnapshot } from "./widgets/buildWorkforceSnapshot.server";

function buildQuickActions(role: HomeSurfacePayload["context"]["role"]): HomeWidgetPayload["quick_actions"] {
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

export async function buildHomeSurfacePayload(): Promise<HomeSurfacePayload> {
  const context = await loadHomeUserContext();
  const layout = resolveHomeLayout(context.role);

  const [
    metricsSnapshot,
    workforceSnapshot,
    routeLockSnapshot,
    dispatchSnapshot,
    activityFeed,
  ] = await Promise.all([
    buildMetricsSnapshot(),
    buildWorkforceSnapshot(),
    buildRouteLockSnapshot(),
    buildDispatchSnapshot(),
    buildActivityFeed(),
  ]);

  return {
    context,
    layout,
    widgets: {
      metrics_snapshot: metricsSnapshot,
      workforce_snapshot: workforceSnapshot,
      route_lock_snapshot: routeLockSnapshot,
      dispatch_snapshot: dispatchSnapshot,
      quick_actions: buildQuickActions(context.role),
      activity_feed: activityFeed,
    },
  };
}
