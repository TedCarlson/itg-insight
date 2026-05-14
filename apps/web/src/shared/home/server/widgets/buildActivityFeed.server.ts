import type { HomeWidgetPayload } from "../../contracts/widget.types";

export async function buildActivityFeed(): Promise<HomeWidgetPayload["activity_feed"]> {
  return {
    title: "Activity Feed",
    items: [
      {
        id: "home-ready",
        label: "Manager Home framework is ready",
        detail: "Live activity wiring can be added widget by widget.",
        tone: "neutral",
      },
    ],
  };
}
