import type {
  HomeWidgetConfig,
  HomeWidgetZone,
} from "./home.types";

import type {
  AppRole,
} from "@/shared/navigation/types";

import type {
  HomeWidgetKind,
} from "@/shared/widgets/contracts/widget.types";

export type WorkspaceScreenPreset =
  | "laptop_14"
  | "desktop_27"
  | "workspace_32"
  | "ultrawide";

export type WorkspaceRailMode =
  | "off"
  | "half"
  | "full";

export type WorkspaceRailPosition =
  | "left"
  | "right";

export type WorkspaceStructureId =
  | "wide-stack"
  | "medium-stack"
  | "metrics-focus"
  | "custom";

export type PersistedWidgetAssignment =
  {
    slot_id: string;
    widget_kind: HomeWidgetKind;
    widget_size?: HomeWidgetConfig["size"];
    zone: HomeWidgetZone;
  };

export type WorkspaceRuntimeConfig = {
  structure_id: WorkspaceStructureId;

  rail_mode: WorkspaceRailMode;
  rail_position: WorkspaceRailPosition;

  screen_preset: WorkspaceScreenPreset;

  widget_assignments: PersistedWidgetAssignment[];
};

export type WorkspacePreferenceRecord =
  {
    workspace_id: string;

    auth_user_id: string;

    role: AppRole;

    pc_org_id: string | null;

    workspace_name: string;

    is_default: boolean;

    runtime_config: WorkspaceRuntimeConfig;

    created_at: string;
    updated_at: string;
  };

export type WorkspaceHydratedLayout =
  {
    workspace_id?: string;

    workspace_name?: string;

    role: AppRole;

    runtime_config: WorkspaceRuntimeConfig;

    widgets: HomeWidgetConfig[];
  };

export type SaveWorkspaceInput = {
  workspace_name: string;

  is_default?: boolean;

  runtime_config: WorkspaceRuntimeConfig;
};

export type SaveWorkspaceResponse =
  WorkspacePreferenceRecord;

export type LoadWorkspaceResponse =
  WorkspaceHydratedLayout;

export type WorkspaceSummary = {
  workspace_id: string;

  workspace_name: string;

  role: AppRole;

  is_default: boolean;

  updated_at: string;
};

export type WorkspaceListResponse =
  WorkspaceSummary[];
