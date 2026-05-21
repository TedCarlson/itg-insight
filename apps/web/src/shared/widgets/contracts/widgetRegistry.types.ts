import type { AppRole } from "@/shared/navigation/types";
import type { HomeWidgetKind, HomeWidgetSize } from "./widget.types";

export type WidgetCategory =
  | "operations"
  | "performance"
  | "workforce"
  | "activity"
  | "navigation";

export type WidgetRegistryItem = {
  kind: HomeWidgetKind;
  label: string;
  description: string;
  category: WidgetCategory;
  allowedRoles: AppRole[];
  defaultSize: HomeWidgetSize;
  allowedSizes: HomeWidgetSize[];
  configurable: boolean;
};
