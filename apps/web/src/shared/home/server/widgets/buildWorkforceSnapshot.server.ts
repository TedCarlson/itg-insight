import type { HomeWidgetPayload } from "../../contracts/widget.types";

export async function buildWorkforceSnapshot(): Promise<HomeWidgetPayload["workforce_snapshot"]> {
  return {
    title: "Workforce Snapshot",
    items: [
      { label: "Active HC", value: "—", note: "Pending workforce wiring" },
      { label: "Training", value: "—", note: "Pending workforce wiring" },
      { label: "Needs Review", value: "—", note: "Pending workforce wiring" },
    ],
  };
}
