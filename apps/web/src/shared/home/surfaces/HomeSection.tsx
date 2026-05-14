import type { HomeSectionConfig, HomeSurfacePayload } from "../contracts/home.types";
import { HomeWidgetGrid } from "./HomeWidgetGrid";

export function HomeSection(props: {
  section: HomeSectionConfig;
  payload: HomeSurfacePayload;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{props.section.title}</h2>
        {props.section.description ? (
          <p className="mt-1 text-sm text-[var(--to-muted)]">{props.section.description}</p>
        ) : null}
      </div>

      <HomeWidgetGrid widgets={props.section.widgets} payload={props.payload} />
    </section>
  );
}
