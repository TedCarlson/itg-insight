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
}) {
  return (
    <HomeWidgetGrid
      widgets={props.section.widgets}
      payload={props.payload}
      zone={props.zone}
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

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-9">
        {mainSections.map((section) => {
          return (
            <WorkspaceSection
              key={section.id}
              section={section}
              payload={props.payload}
              zone="main"
            />
          );
        })}
      </div>

      {railSections.length > 0 ? (
        <aside className="space-y-4 xl:col-span-3">
          {railSections.map((section) => {
            return (
              <WorkspaceSection
                key={section.id}
                section={section}
                payload={props.payload}
                zone="rail"
              />
            );
          })}
        </aside>
      ) : null}
    </div>
  );
}
