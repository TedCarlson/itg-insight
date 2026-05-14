import type { HomeWidgetPayload } from "../../contracts/widget.types";

export async function buildRouteLockSnapshot(): Promise<HomeWidgetPayload["route_lock_snapshot"]> {
  return {
    title: "Route Lock",
    items: [
      { label: "Today", value: "—", note: "Pending route-lock wiring" },
      { label: "Eligible", value: "—", note: "Pending route-lock wiring" },
      { label: "Quota", value: "—", note: "Pending route-lock wiring" },
    ],
  };
}
