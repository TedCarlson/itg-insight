import type { HomeWidgetPayload } from "../../contracts/widget.types";
import { SnapshotMetricGrid } from "./SnapshotMetricGrid";

export function RouteLockSnapshotWidget(props: {
  payload: HomeWidgetPayload["route_lock_snapshot"];
}) {
  return <SnapshotMetricGrid title={props.payload.title} items={props.payload.items} />;
}
