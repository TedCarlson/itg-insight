import type { HomeWidgetPayload } from "../../contracts/widget.types";

export async function buildMetricsSnapshot(): Promise<HomeWidgetPayload["metrics_snapshot"]> {
  return {
    title: "Metrics Snapshot",
    items: [
      { label: "tNPS", value: "—", note: "Pending metrics wiring" },
      { label: "FTR", value: "—", note: "Pending metrics wiring" },
      { label: "Tool Usage", value: "—", note: "Pending metrics wiring" },
    ],
  };
}
