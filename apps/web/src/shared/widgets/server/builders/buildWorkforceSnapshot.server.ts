import type { HomeWidgetPayload } from "@/shared/widgets/contracts/widget.types";

export async function buildWorkforceSnapshot(): Promise<
  HomeWidgetPayload["workforce_snapshot"]
> {
  return {
    title: "Workforce Snapshot",
    headline: "Workforce readiness",
    subhead: "Staffing mix, onboarding flow, app access, and review signals.",
    items: [
      {
        label: "Local / Travel",
        value: "— / —",
        note: "Active HC split pending workforce wiring",
        tone: "neutral",
      },
      {
        label: "Onboarding / Training",
        value: "— / —",
        note: "Pending people and training status wiring",
        tone: "neutral",
      },
      {
        label: "App Access",
        value: "—%",
        note: "Active HC with app access",
        tone: "neutral",
      },
      {
        label: "Needs Review",
        value: "—",
        note: "Access, assignment, or profile issues",
        tone: "warn",
      },
    ],
    alerts: [
      {
        id: "workforce-needs-review",
        label: "Needs Review queue ready",
        detail: "This tile will surface assignment, app access, onboarding, and profile mismatch issues.",
        tone: "warn",
      },
    ],
    links: [
      {
        label: "Open Workforce",
        href: "/company-manager/workforce",
        description: "Review active workforce and assignments.",
      },
      {
        label: "Open People",
        href: "/company-manager/people",
        description: "Review people and onboarding.",
      },
    ],
  };
}
