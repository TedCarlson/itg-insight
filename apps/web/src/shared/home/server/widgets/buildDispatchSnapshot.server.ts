import type { HomeWidgetPayload } from "../../contracts/widget.types";

export async function buildDispatchSnapshot(): Promise<HomeWidgetPayload["dispatch_snapshot"]> {
  return {
    title: "Dispatch Signal",
    items: [
      { label: "Open Events", value: "—", note: "Pending dispatch wiring" },
      { label: "Call Outs", value: "—", note: "Pending dispatch wiring" },
      { label: "Moves", value: "—", note: "Pending dispatch wiring" },
    ],
  };
}
