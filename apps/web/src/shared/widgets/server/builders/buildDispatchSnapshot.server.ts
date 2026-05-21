import type { HomeWidgetPayload } from "@/shared/widgets/contracts/widget.types";

export async function buildDispatchSnapshot(): Promise<
  HomeWidgetPayload["dispatch_snapshot"]
> {
  return {
    title: "Dispatch Signal",
    headline: "Today’s field movement",
    subhead: "Open events, call outs, moves, and capacity signals.",
    items: [
      {
        label: "Open Events",
        value: "—",
        note: "Pending dispatch wiring",
        tone: "neutral",
      },
      {
        label: "Call Outs",
        value: "—",
        note: "Pending call-out feed",
        tone: "neutral",
      },
      {
        label: "Moves",
        value: "—",
        note: "Pending tech-move feed",
        tone: "neutral",
      },
      {
        label: "Net Capacity",
        value: "—",
        note: "Pending capacity delta",
        tone: "warn",
      },
    ],
    alerts: [
      {
        id: "dispatch-capacity-ready",
        label: "Capacity signal ready",
        detail: "This widget will surface call outs, add-ins, moves, and route capacity impact.",
        tone: "warn",
      },
    ],
    links: [
      {
        label: "Open Dispatch",
        href: "/dispatch-console",
        description: "Open today’s dispatch operating console.",
      },
    ],
  };
}
