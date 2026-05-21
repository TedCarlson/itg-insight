import type { ReactNode } from "react";

import { ActivityFeedWidget } from "@/shared/widgets/ui/ActivityFeedWidget";
import { DispatchSnapshotWidget } from "@/shared/widgets/ui/DispatchSnapshotWidget";
import { MetricsSnapshotWidget } from "@/shared/widgets/ui/MetricsSnapshotWidget";
import { QuickActionsWidget } from "@/shared/widgets/ui/QuickActionsWidget";
import { RouteLockSnapshotWidget } from "@/shared/widgets/ui/RouteLockSnapshotWidget";
import { WorkforceSnapshotWidget } from "@/shared/widgets/ui/WorkforceSnapshotWidget";

import type { HomeWidgetConfig, HomeSurfacePayload } from "@/shared/home/contracts/home.types";
import type { HomeWidgetKind } from "../contracts/widget.types";

export type WidgetRenderer = (args: {
  widget: HomeWidgetConfig;
  payload: HomeSurfacePayload;
}) => ReactNode;

export const widgetComponentRegistry: Partial<Record<HomeWidgetKind, WidgetRenderer>> = {
  metrics_snapshot: ({ widget, payload }) => (
    <MetricsSnapshotWidget
      widget={widget}
      payload={payload.widgets.metrics_snapshot}
    />
  ),

  workforce_snapshot: ({ widget, payload }) => (
    <WorkforceSnapshotWidget
      widget={widget}
      payload={payload.widgets.workforce_snapshot}
    />
  ),

  route_lock_snapshot: ({ widget, payload }) => (
    <RouteLockSnapshotWidget
      widget={widget}
      payload={payload.widgets.route_lock_snapshot}
    />
  ),

  dispatch_snapshot: ({ widget, payload }) => (
    <DispatchSnapshotWidget
      widget={widget}
      payload={payload.widgets.dispatch_snapshot}
    />
  ),

  quick_actions: ({ payload }) => (
    <QuickActionsWidget payload={payload.widgets.quick_actions} />
  ),

  activity_feed: ({ widget, payload }) => (
    <ActivityFeedWidget
      widget={widget}
      payload={payload.widgets.activity_feed}
    />
  ),
};
