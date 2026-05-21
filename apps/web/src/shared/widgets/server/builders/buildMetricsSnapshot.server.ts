import type { HomeWidgetPayload } from "@/shared/widgets/contracts/widget.types";

export async function buildMetricsSnapshot(): Promise<
  HomeWidgetPayload["metrics_snapshot"]
> {
  return {
    title: "Metrics Snapshot",
    headline: "Performance pulse",
    subhead: "Selected KPI signals for the current operating view.",
    items: [
      {
        label: "tNPS",
        value: "—",
        note: "Pending metrics wiring",
        tone: "neutral",
      },
      {
        label: "FTR",
        value: "—",
        note: "Pending metrics wiring",
        tone: "neutral",
      },
      {
        label: "Tool Usage",
        value: "—",
        note: "Pending metrics wiring",
        tone: "neutral",
      },
      {
        label: "Composite",
        value: "—",
        note: "Pending score wiring",
        tone: "neutral",
      },
    ],
    alerts: [
      {
        id: "metrics-configurable-kpis",
        label: "Configurable KPI set ready",
        detail: "This widget will support selected KPI emphasis by layout size and user preference.",
        tone: "good",
      },
    ],
    links: [
      {
        label: "Open Metrics",
        href: "/company-manager/metrics",
        description: "Open full manager metrics reporting.",
      },
    ],
  };
}
