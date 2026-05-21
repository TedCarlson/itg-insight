import type {
  HomeWidgetKind,
  HomeWidgetSize,
} from "@/shared/widgets/contracts/widget.types";

import type {
  HomeWidgetZone,
} from "../contracts/home.types";

export type WorkspaceRailMode =
  | "off"
  | "half"
  | "full";

export type WorkspaceRailPosition =
  | "left"
  | "right";

export type WorkspaceScreenPreset =
  | "laptop_14"
  | "desktop_27"
  | "workspace_32"
  | "ultrawide";

export type WorkspaceMainSlotSize =
  Extract<HomeWidgetSize, "small" | "medium" | "wide">;

export type WorkspaceSlot = {
  id: string;
  zone: HomeWidgetZone;
  size: HomeWidgetSize;
  allowedWidgets: HomeWidgetKind[];
  assignedWidget?: HomeWidgetKind;
};

export type WorkspaceLayoutRow = {
  id: string;
  slots: Array<{
    id: string;
    size: WorkspaceMainSlotSize;
    allowedWidgets: HomeWidgetKind[];
  }>;
};

export type WorkspaceLayoutPreview = {
  id: string;
  label: string;
  description: string;
  rows: WorkspaceLayoutRow[];
};
