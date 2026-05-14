import type { HomeWidgetPayload } from "../../contracts/widget.types";
import { SnapshotMetricGrid } from "./SnapshotMetricGrid";

export function DispatchSnapshotWidget(props: {
  payload: HomeWidgetPayload["dispatch_snapshot"];
}) {
  return <SnapshotMetricGrid title={props.payload.title} items={props.payload.items} />;
}
