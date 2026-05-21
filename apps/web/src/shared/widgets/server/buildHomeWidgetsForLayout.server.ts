import { buildActivityFeed } from "./builders/buildActivityFeed.server";
import { buildDispatchSnapshot } from "./builders/buildDispatchSnapshot.server";
import { buildMetricsSnapshot } from "./builders/buildMetricsSnapshot.server";
import { buildQuickActions } from "./builders/buildQuickActions.server";
import { buildRouteLockSnapshot } from "./builders/buildRouteLockSnapshot.server";
import { buildWorkforceSnapshot } from "./builders/buildWorkforceSnapshot.server";

import type {
  HomeLayoutConfig,
  HomeSurfacePayload,
} from "@/shared/home/contracts/home.types";
import type { HomeWidgetKind } from "../contracts/widget.types";

type HomeContext = HomeSurfacePayload["context"];
type WidgetPayloadMap = HomeSurfacePayload["widgets"];

type WidgetBuilder<K extends HomeWidgetKind> = (
  context: HomeContext,
) => Promise<WidgetPayloadMap[K]> | WidgetPayloadMap[K];

const widgetBuilderRegistry: {
  [K in HomeWidgetKind]: WidgetBuilder<K>;
} = {
  metrics_snapshot: () => buildMetricsSnapshot(),
  workforce_snapshot: () => buildWorkforceSnapshot(),
  route_lock_snapshot: () => buildRouteLockSnapshot(),
  dispatch_snapshot: () => buildDispatchSnapshot(),
  quick_actions: (context) => buildQuickActions(context.role),
  activity_feed: () => buildActivityFeed(),
};

function getLayoutWidgetKinds(layout: HomeLayoutConfig): HomeWidgetKind[] {
  return Array.from(
    new Set(
      layout.sections.flatMap((section) => {
        return section.widgets.map((widget) => widget.kind);
      }),
    ),
  );
}

export async function buildHomeWidgetsForLayout(
  layout: HomeLayoutConfig,
  context: HomeContext,
): Promise<WidgetPayloadMap> {
  const widgetKinds = getLayoutWidgetKinds(layout);

  const entries = await Promise.all(
    widgetKinds.map(async (kind) => {
      const payload = await widgetBuilderRegistry[kind](context);

      return [kind, payload] as const;
    }),
  );

  return Object.fromEntries(entries) as WidgetPayloadMap;
}
