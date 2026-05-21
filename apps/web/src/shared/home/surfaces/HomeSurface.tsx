"use client";

import { useMemo, useState } from "react";

import { WorkspaceBuilderPreview } from "../builder/WorkspaceBuilderPreview";

import type {
  HomeLayoutConfig,
  HomeSurfacePayload,
} from "../contracts/home.types";

import {
  resolveWorkspacePreset,
  type WorkspacePresetKey,
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

function saveLayout(
  layout: HomeLayoutConfig,
) {
  window.localStorage.setItem(
    LOCAL_WORKSPACE_KEY,
    JSON.stringify(layout),
  );
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
    preset,
    setPreset,
  ] =
    useState<WorkspacePresetKey>(
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
  ] = useState<HomeLayoutConfig | null>(() => {
    return readSavedLayout();
  });

  const resolvedLayout =
    useMemo(() => {
      return (
        previewLayout ??
        savedLayout ??
        resolveWorkspacePreset(
          preset,
        )
      );
    }, [
      preset,
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
        activePreset={preset}
        hasUnsavedPreview={Boolean(
          previewLayout,
        )}
        hasSavedWorkspace={Boolean(
          savedLayout,
        )}
        onResetWorkspace={() => {
          clearSavedLayout();
          setSavedLayout(null);
          setPreviewLayout(null);
        }}
        onSaveWorkspace={() => {
          if (!previewLayout) {
            return;
          }

          saveLayout(previewLayout);
          setSavedLayout(previewLayout);
          setPreviewLayout(null);
        }}
        onPresetChange={(nextPreset) => {
          setPreviewLayout(null);
          setSavedLayout(null);
          setPreset(nextPreset);
        }}
        onEditLayout={() => {
          setBuilderOpen((value) => !value);
        }}
      />

      {builderOpen ? (
        <WorkspaceBuilderPreview
          onApplyLayout={(layout) => {
            setPreviewLayout(layout);
            setBuilderOpen(false);
          }}
        />
      ) : (
        <HomeWorkspace payload={payload} />
      )}
    </div>
  );
}
