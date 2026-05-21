import type {
  HomeSectionConfig,
  HomeSurfacePayload,
  HomeWidgetConfig,
  HomeWidgetZone,
} from "../contracts/home.types";

import { HomeWidgetGrid } from "./HomeWidgetGrid";

function resolveZone(widget: HomeWidgetConfig): HomeWidgetZone {
  if (widget.zone) return widget.zone;

  if (
    widget.size === "rail_half" ||
    widget.size === "rail_full"
  ) {
    return "rail";
  }

  return "main";
}

function sectionWithWidgets(
  section: HomeSectionConfig,
  widgets: HomeWidgetConfig[],
): HomeSectionConfig {
  return {
    ...section,
    widgets,
  };
}

function splitSectionsByZone(
  sections: HomeSectionConfig[],
) {
  const mainSections: HomeSectionConfig[] = [];
  const railSections: HomeSectionConfig[] = [];

  for (const section of sections) {
    const mainWidgets =
      section.widgets.filter((widget) => {
        return resolveZone(widget) === "main";
      });

    const railWidgets =
      section.widgets.filter((widget) => {
        return resolveZone(widget) === "rail";
      });

    if (mainWidgets.length > 0) {
      mainSections.push(
        sectionWithWidgets(
          section,
          mainWidgets,
        ),
      );
    }

    if (railWidgets.length > 0) {
      railSections.push(
        sectionWithWidgets(
          section,
          railWidgets,
        ),
      );
    }
  }

  return {
    mainSections,
    railSections,
  };
}

function WorkspaceSection(props: {
  section: HomeSectionConfig;
  payload: HomeSurfacePayload;
  zone: HomeWidgetZone;
  hasRail: boolean;
}) {
  return (
    <HomeWidgetGrid
      widgets={props.section.widgets}
      payload={props.payload}
      zone={props.zone}
      hasRail={props.hasRail}
    />
  );
}

export function HomeWorkspace(props: {
  payload: HomeSurfacePayload;
}) {
  const {
    mainSections,
    railSections,
  } = splitSectionsByZone(
    props.payload.layout.sections,
  );

  const hasRail =
    railSections.length > 0;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div
        className={
          hasRail
            ? "space-y-6 xl:col-span-9"
            : "space-y-6 xl:col-span-12"
        }
      >
        {mainSections.map((section) => {
          return (
            <WorkspaceSection
              key={section.id}
              section={section}
              payload={props.payload}
              zone="main"
              hasRail={hasRail}
            />
          );
        })}
      </div>

      {hasRail ? (
        <aside className="space-y-4 xl:col-span-3">
          {railSections.map((section) => {
            return (
              <WorkspaceSection
                key={section.id}
                section={section}
                payload={props.payload}
                zone="rail"
                hasRail={hasRail}
              />
            );
          })}
        </aside>
      ) : null}
    </div>
  );
}
