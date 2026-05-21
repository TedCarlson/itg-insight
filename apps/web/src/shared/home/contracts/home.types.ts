import type { AppRole } from "@/shared/navigation/types";
import type { HomeWidgetKind, HomeWidgetPayload, HomeWidgetSize } from "@/shared/widgets/contracts/widget.types";

export type HomeWidgetZone = "main" | "rail";

export type HomeSurfaceContext = {
  full_name: string | null;
  role: AppRole;
  org_label: string | null;
  selected_pc_org_id: string | null;
  has_linked_person: boolean;
  has_selected_org: boolean;
};

export type HomeWidgetConfig = {
  id: string;
  kind: HomeWidgetKind;
  title: string;
  size: HomeWidgetSize;
  zone?: HomeWidgetZone;
};

export type HomeSectionConfig = {
  id: string;
  title: string;
  description?: string | null;
  widgets: HomeWidgetConfig[];
};

export type HomeLayoutConfig = {
  id: string;
  label: string;
  role: AppRole;
  sections: HomeSectionConfig[];
};

export type HomeSurfacePayload = {
  context: HomeSurfaceContext;
  layout: HomeLayoutConfig;
  widgets: HomeWidgetPayload;
};
