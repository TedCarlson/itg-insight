import type { HomeWidgetPayload } from "../../contracts/widget.types";
import { SnapshotMetricGrid } from "./SnapshotMetricGrid";

export function WorkforceSnapshotWidget(props: {
  payload: HomeWidgetPayload["workforce_snapshot"];
}) {
  return <SnapshotMetricGrid title={props.payload.title} items={props.payload.items} />;
}
