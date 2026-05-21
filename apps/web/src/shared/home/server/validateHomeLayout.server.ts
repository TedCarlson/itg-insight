import { resolveWidgetRegistryItem } from "@/shared/widgets/registry/resolveWidgetRegistryItem";

import type {
  HomeLayoutConfig,
} from "../contracts/home.types";

import type { AppRole } from "@/shared/navigation/types";

export function validateHomeLayout(
  role: AppRole,
  layout: HomeLayoutConfig,
): HomeLayoutConfig {
  return {
    ...layout,

    sections: layout.sections
      .map((section) => {
        return {
          ...section,

          widgets: section.widgets.filter((widget) => {
            const registryItem =
              resolveWidgetRegistryItem(widget.kind);

            if (!registryItem) {
              return false;
            }

            return registryItem.allowedRoles.includes(role);
          }),
        };
      })
      .filter((section) => section.widgets.length > 0),
  };
}
