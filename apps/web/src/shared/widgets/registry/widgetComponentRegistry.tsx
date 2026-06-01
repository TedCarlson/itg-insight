import type { ReactNode } from "react";

import { ActivityFeedWidget } from "@/shared/widgets/ui/ActivityFeedWidget";
import { DispatchSnapshotWidget } from "@/shared/widgets/ui/DispatchSnapshotWidget";
import { MetricsSnapshotWidget } from "@/shared/widgets/ui/MetricsSnapshotWidget";
import { QuickActionsWidget } from "@/shared/widgets/ui/QuickActionsWidget";
import { RouteLockSnapshotWidget } from "@/shared/widgets/ui/RouteLockSnapshotWidget";
import { WorkforceSnapshotWidget } from "@/shared/widgets/ui/WorkforceSnapshotWidget";
import { SmartUploadWidget } from "@/shared/widgets/ui/SmartUploadWidget";

import type { HomeWidgetConfig, HomeSurfacePayload } from "@/shared/home/contracts/home.types";
import type { HomeWidgetKind } from "../contracts/widget.types";

export type WidgetRenderer = (args: {
  widget: HomeWidgetConfig;
  payload: HomeSurfacePayload;
}) => ReactNode;

function MissingWidgetPayload(props: { widget: HomeWidgetConfig }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-dashed border-[var(--to-border)] bg-[var(--to-card-muted)] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-muted)]">
        {props.widget.title}
      </div>
      <div className="mt-2 text-sm text-[var(--to-muted)]">
        This widget is not available for the current role or org scope.
      </div>
    </div>
  );
}

export const widgetComponentRegistry: Partial<Record<HomeWidgetKind, WidgetRenderer>> = {
  metrics_snapshot: ({ widget, payload }) =>
    payload.widgets.metrics_snapshot ? (
      <MetricsSnapshotWidget
        widget={widget}
        payload={payload.widgets.metrics_snapshot}
      />
    ) : (
      <MissingWidgetPayload widget={widget} />
    ),

  workforce_snapshot: ({ widget, payload }) =>
    payload.widgets.workforce_snapshot ? (
      <WorkforceSnapshotWidget
        widget={widget}
        payload={payload.widgets.workforce_snapshot}
      />
    ) : (
      <MissingWidgetPayload widget={widget} />
    ),

  route_lock_snapshot: ({ widget, payload }) =>
    payload.widgets.route_lock_snapshot ? (
      <RouteLockSnapshotWidget
        widget={widget}
        payload={payload.widgets.route_lock_snapshot}
      />
    ) : (
      <MissingWidgetPayload widget={widget} />
    ),

  dispatch_snapshot: ({ widget, payload }) =>
    payload.widgets.dispatch_snapshot ? (
      <DispatchSnapshotWidget
        widget={widget}
        payload={payload.widgets.dispatch_snapshot}
      />
    ) : (
      <MissingWidgetPayload widget={widget} />
    ),

  quick_actions: ({ widget, payload }) =>
    payload.widgets.quick_actions ? (
      <QuickActionsWidget payload={payload.widgets.quick_actions} />
    ) : (
      <MissingWidgetPayload widget={widget} />
    ),

  activity_feed: ({ widget, payload }) =>
    payload.widgets.activity_feed ? (
      <ActivityFeedWidget
        widget={widget}
        payload={payload.widgets.activity_feed}
      />
    ) : (
      <MissingWidgetPayload widget={widget} />
    ),

  smart_upload: () => (
    <SmartUploadWidget />
  ),
};
