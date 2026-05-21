// Path: apps/web/src/shared/home/surfaces/HomeWidgetGrid.tsx

import { Card } from "@/components/ui/Card";
import {
  widgetComponentRegistry,
} from "@/shared/widgets/registry/widgetComponentRegistry";

import type {
  HomeSurfacePayload,
  HomeWidgetConfig,
  HomeWidgetZone,
} from "../contracts/home.types";

function mainSizeClass(size: HomeWidgetConfig["size"]) {
  switch (size) {
    case "small":
      return "col-span-12 md:col-span-6 xl:col-span-4";

    case "medium":
      return "col-span-12 xl:col-span-6";

    case "wide":
      return "col-span-12";

    case "rail_half":
    case "rail_full":
      return "col-span-12";

    default:
      return "col-span-12";
  }
}

function railSizeClass(size: HomeWidgetConfig["size"]) {
  switch (size) {
    case "rail_full":
      return "min-h-[calc(100vh-14rem)] overflow-hidden";

    case "rail_half":
      return "max-h-[420px] overflow-hidden";

    default:
      return "";
  }
}

function renderWidget(
  widget: HomeWidgetConfig,
  payload: HomeSurfacePayload,
) {
  const renderer =
    widgetComponentRegistry[widget.kind];

  if (!renderer) {
    return (
      <div className="text-sm text-[var(--to-muted)]">
        Unsupported widget: {widget.kind}
      </div>
    );
  }

  return renderer({
    widget,
    payload,
  });
}

export function HomeWidgetGrid(props: {
  widgets: HomeWidgetConfig[];
  payload: HomeSurfacePayload;
  zone?: HomeWidgetZone;
}) {
  const zone = props.zone ?? "main";

  if (zone === "rail") {
    return (
      <div className="space-y-4">
        {props.widgets.map((widget) => {
          return (
            <Card
              key={widget.id}
              className={`p-4 ${railSizeClass(widget.size)}`}
            >
              {renderWidget(widget, props.payload)}
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {props.widgets.map((widget) => {
        return (
          <Card
            key={widget.id}
            className={`p-4 ${mainSizeClass(widget.size)}`}
          >
            {renderWidget(widget, props.payload)}
          </Card>
        );
      })}
    </div>
  );
}
