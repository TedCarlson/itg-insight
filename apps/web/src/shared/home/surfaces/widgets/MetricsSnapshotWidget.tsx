import type { HomeWidgetPayload } from "../../contracts/widget.types";
import { SnapshotMetricGrid } from "./SnapshotMetricGrid";

export function MetricsSnapshotWidget(props: {
  payload: HomeWidgetPayload["metrics_snapshot"];
}) {
  return <SnapshotMetricGrid title={props.payload.title} items={props.payload.items} />;
}
