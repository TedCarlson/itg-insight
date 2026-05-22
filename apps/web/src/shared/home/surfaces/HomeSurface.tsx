"use client";

import { useEffect, useMemo, useState } from "react";

import { WorkspaceBuilderPreview } from "../builder/WorkspaceBuilderPreview";

import type {
  HomeLayoutConfig,
  HomeSurfacePayload,
} from "../contracts/home.types";

import {
  resolveWorkspacePreset,
} from "../config/presetRegistry";

import { HomeWorkspace } from "./HomeWorkspace";
import { HomeWorkspaceControlStrip } from "./HomeWorkspaceControlStrip";

const LOCAL_WORKSPACE_KEY =
  "insight:home:workspace:v1";

function readSavedLayout(): HomeLayoutConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(
        LOCAL_WORKSPACE_KEY,
      );

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as HomeLayoutConfig;
  } catch {
    return null;
  }
}

async function saveLayout(
  layout: HomeLayoutConfig,
  payload: HomeSurfacePayload,
) {
  window.localStorage.setItem(
    LOCAL_WORKSPACE_KEY,
    JSON.stringify(layout),
  );

  try {
    const response = await fetch(
      "/api/home/workspaces",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          debug_payload_marker: "home_workspace_save",
          workspace_name:
            layout.label ??
            "Workspace",

          role:
            payload.context.role,

          pc_org_id:
            payload.context
              .selected_pc_org_id ??
            null,

          is_default: true,

          runtime_config: {
            structure_id:
              "my_layout",

            rail_mode:
              layout.sections.some(
                (section) =>
                  section.widgets.some(
                    (widget) =>
                      widget.zone ===
                      "rail",
                  ),
              )
                ? "full"
                : "off",

            rail_position:
              "right",

            screen_preset:
              "workspace_32",

            widget_assignments:
              layout.sections.flatMap(
                (section) => {
                  return section.widgets.map(
                    (widget) => {
                      return {
                        slot_id:
                          widget.id,

                        widget_kind:
                          widget.kind,

                        widget_size:
                          widget.size,

                        zone:
                          widget.zone ??
                          "main",
                      };
                    },
                  );
                },
              ),
          },
        }),
      },
    );

    if (!response.ok) {
      const details = await response.text();

      console.error(
        "workspace_db_save_failed",
        response.status,
        details,
      );
    }
  } catch (error) {
    console.error(
      "workspace_save_failed",
      error,
    );
  }
}


async function loadDbDefaultLayout(
  payload: HomeSurfacePayload,
): Promise<HomeLayoutConfig | null> {
  const params = new URLSearchParams();

  params.set(
    "role",
    payload.context.role,
  );

  if (payload.context.selected_pc_org_id) {
    params.set(
      "pc_org_id",
      payload.context.selected_pc_org_id,
    );
  }

  const response = await fetch(
    `/api/home/workspaces/default?${params.toString()}`,
  );

  if (!response.ok) {
    return null;
  }

  const json = await response.json();

  const workspace =
    json?.workspace;

  if (!workspace?.runtime_config) {
    return null;
  }

  const assignments =
    workspace.runtime_config.widget_assignments ?? [];

  return {
    id: workspace.workspace_id ?? "saved-workspace",
    role: payload.context.role,
    label: workspace.workspace_name ?? "Saved Workspace",
    sections: [
      {
        id: "main",
        title: "Main",
        widgets: assignments
          .filter((item: { zone?: string }) => item.zone !== "rail")
          .map((item: {
            slot_id: string;
            widget_kind: HomeLayoutConfig["sections"][number]["widgets"][number]["kind"];
            widget_size?: HomeLayoutConfig["sections"][number]["widgets"][number]["size"];
          }) => {
            return {
              id: item.slot_id,
              kind: item.widget_kind,
              title: item.widget_kind.replaceAll("_", " "),
              size: item.widget_size ?? "wide",
              zone: "main" as const,
            };
          }),
      },
      {
        id: "rail",
        title: "Rail",
        widgets: assignments
          .filter((item: { zone?: string }) => item.zone === "rail")
          .map((item: {
            slot_id: string;
            widget_kind: HomeLayoutConfig["sections"][number]["widgets"][number]["kind"];
            widget_size?: HomeLayoutConfig["sections"][number]["widgets"][number]["size"];
          }) => {
            return {
              id: item.slot_id,
              kind: item.widget_kind,
              title: item.widget_kind.replaceAll("_", " "),
              size:
                item.widget_size ??
                (workspace.runtime_config.rail_mode === "half"
                  ? "rail_half"
                  : "rail_full"),
              zone: "rail" as const,
            };
          }),
      },
    ].filter((section) => section.widgets.length > 0),
  };
}

function clearSavedLayout() {
  window.localStorage.removeItem(
    LOCAL_WORKSPACE_KEY,
  );
}

export function HomeSurface(props: {
  payload: HomeSurfacePayload;
}) {
  const [
    layoutMode,
    setLayoutMode,
  ] = useState<"default" | "my_layout">(
    "default",
  );

  const [
    builderOpen,
    setBuilderOpen,
  ] = useState(false);

  const [
    previewLayout,
    setPreviewLayout,
  ] = useState<HomeLayoutConfig | null>(null);

  const [
    savedLayout,
    setSavedLayout,
  ] = useState<HomeLayoutConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const dbLayout =
          await loadDbDefaultLayout(
            props.payload,
          );

        if (cancelled) {
          return;
        }

        if (dbLayout) {
          setSavedLayout(dbLayout);
          setLayoutMode("my_layout");
          return;
        }

        const localLayout =
          readSavedLayout();

        if (
          !cancelled &&
          localLayout
        ) {
          setSavedLayout(
            localLayout,
          );
          setLayoutMode("my_layout");
        }
      } catch (error) {
        console.error(
          "workspace_default_load_failed",
          error,
        );
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [props.payload]);

  const resolvedLayout =
    useMemo(() => {
      return (
        previewLayout ??
        (layoutMode === "my_layout"
          ? savedLayout
          : null) ??
        resolveWorkspacePreset(
          "default",
        )
      );
    }, [
      layoutMode,
      previewLayout,
      savedLayout,
    ]);

  const payload =
    useMemo(() => {
      return {
        ...props.payload,
        layout: resolvedLayout,
      };
    }, [
      props.payload,
      resolvedLayout,
    ]);

  return (
    <div className="space-y-5">
      <div
        id="shell-role-hint"
        data-shell-role={
          payload.context.role
        }
        className="hidden"
        aria-hidden="true"
      />

      <HomeWorkspaceControlStrip
        payload={payload}
        activeLayoutMode={previewLayout ? "my_layout" : layoutMode}
        hasSavedWorkspace={Boolean(
          savedLayout,
        )}
        onResetWorkspace={() => {
          clearSavedLayout();
          setSavedLayout(null);
          setPreviewLayout(null);
        }}
        onLayoutModeChange={(nextMode) => {
          setPreviewLayout(null);
          setLayoutMode(nextMode);
        }}
        onEditLayout={() => {
          setBuilderOpen((value) => !value);
        }}
      />

      {builderOpen ? (
        <WorkspaceBuilderPreview
          onApplyLayout={(layout) => {
            void saveLayout(
              layout,
              payload,
            );

            setSavedLayout(layout);
            setPreviewLayout(null);
            setLayoutMode("my_layout");
            setBuilderOpen(false);
          }}
        />
      ) : (
        <HomeWorkspace payload={payload} />
      )}
    </div>
  );
}
