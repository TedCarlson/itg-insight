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

  const resolvedLayout =
    useMemo(() => {
      return (
        previewLayout ??
        resolveWorkspacePreset(
          preset,
        )
      );
    }, [preset, previewLayout]);

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
        onPresetChange={(nextPreset) => {
          setPreviewLayout(null);
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
