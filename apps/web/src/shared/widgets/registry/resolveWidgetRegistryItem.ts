import { widgetRegistry } from "./widgetRegistry";

import type { HomeWidgetKind } from "../contracts/widget.types";
import type { WidgetRegistryItem } from "../contracts/widgetRegistry.types";

export function resolveWidgetRegistryItem(
  kind: HomeWidgetKind,
): WidgetRegistryItem | null {
  return widgetRegistry[kind] ?? null;
}
