import { Card } from "@/components/ui/Card";
import type { HomeSurfacePayload, HomeWidgetConfig } from "../contracts/home.types";
import { ActivityFeedWidget } from "./widgets/ActivityFeedWidget";
import { DispatchSnapshotWidget } from "./widgets/DispatchSnapshotWidget";
import { MetricsSnapshotWidget } from "./widgets/MetricsSnapshotWidget";
import { QuickActionsWidget } from "./widgets/QuickActionsWidget";
import { RouteLockSnapshotWidget } from "./widgets/RouteLockSnapshotWidget";
import { WorkforceSnapshotWidget } from "./widgets/WorkforceSnapshotWidget";

function sizeClass(size: HomeWidgetConfig["size"]) {
  if (size === "wide") return "lg:col-span-2";
  if (size === "lg") return "lg:col-span-2";
  return "";
}

function renderWidget(widget: HomeWidgetConfig, payload: HomeSurfacePayload) {
  switch (widget.kind) {
    case "metrics_snapshot":
      return <MetricsSnapshotWidget payload={payload.widgets.metrics_snapshot} />;
    case "workforce_snapshot":
      return <WorkforceSnapshotWidget payload={payload.widgets.workforce_snapshot} />;
    case "route_lock_snapshot":
      return <RouteLockSnapshotWidget payload={payload.widgets.route_lock_snapshot} />;
    case "dispatch_snapshot":
      return <DispatchSnapshotWidget payload={payload.widgets.dispatch_snapshot} />;
    case "quick_actions":
      return <QuickActionsWidget payload={payload.widgets.quick_actions} />;
    case "activity_feed":
      return <ActivityFeedWidget payload={payload.widgets.activity_feed} />;
    default:
      return null;
  }
}

export function HomeWidgetGrid(props: {
  widgets: HomeWidgetConfig[];
  payload: HomeSurfacePayload;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {props.widgets.map((widget) => (
        <Card key={widget.id} className={`p-4 ${sizeClass(widget.size)}`}>
          {renderWidget(widget, props.payload)}
        </Card>
      ))}
    </div>
  );
}
