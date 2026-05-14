import { Card } from "@/components/ui/Card";
import type { HomeSurfacePayload } from "../contracts/home.types";
import { HomeSection } from "./HomeSection";

export function HomeSurface(props: {
  payload: HomeSurfacePayload;
}) {
  const { payload } = props;
  const displayName = payload.context.full_name ?? "there";
  const orgLabel = payload.context.org_label ?? "No org selected";

  return (
    <div className="space-y-6">
      <div
        id="shell-role-hint"
        data-shell-role={payload.context.role}
        className="hidden"
        aria-hidden="true"
      />

      <Card className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-muted)]">
              {payload.layout.label}
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Welcome, {displayName}</h1>
            <p className="mt-1 text-sm text-[var(--to-muted)]">
              {payload.context.role.replaceAll("_", " ")} • {orgLabel}
            </p>
          </div>

          <div className="rounded-full border border-[var(--to-border)] px-3 py-1 text-xs text-[var(--to-muted)]">
            Default layout
          </div>
        </div>
      </Card>

      {payload.layout.sections.map((section) => (
        <HomeSection key={section.id} section={section} payload={payload} />
      ))}
    </div>
  );
}
