"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

import type {
  HomeSurfacePayload,
} from "../contracts/home.types";

type PresetKey =
  | "default"
  | "operations"
  | "people"
  | "metrics";

function formatRole(role: string) {
  return role.replaceAll("_", " ");
}

const PRESET_LABELS: Record<
  PresetKey,
  string
> = {
  default: "Default",
  operations: "Operations",
  people: "People",
  metrics: "Metrics",
};

export function HomeWorkspaceControlStrip(props: {
  payload: HomeSurfacePayload;
  activePreset?: PresetKey;
  onPresetChange?: (
    preset: PresetKey,
  ) => void;
  onEditLayout?: () => void;
  onSaveWorkspace?: () => void;
  onResetWorkspace?: () => void;
  hasUnsavedPreview?: boolean;
  hasSavedWorkspace?: boolean;
}) {
  const [
    presetMenuOpen,
    setPresetMenuOpen,
  ] = useState(false);

  const displayName =
    props.payload.context.full_name ??
    "Manager";

  const orgLabel =
    props.payload.context.org_label ??
    props.payload.context.selected_pc_org_id ??
    "No org selected";

  const activePreset =
    props.activePreset ?? "default";

  return (
    <div className="rounded-2xl border border-[var(--to-border)] bg-[var(--to-card)] px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--to-muted)]">
            {formatRole(
              props.payload.context.role,
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="truncate text-base font-semibold text-[var(--to-foreground)]">
              {displayName}
            </div>

            <div className="text-sm text-[var(--to-muted)]">
              · Org {orgLabel}
            </div>

            <div className="text-sm text-[var(--to-muted)]">
              · {
                PRESET_LABELS[
                  activePreset
                ]
              } Workspace
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-[var(--to-border)] bg-[var(--to-card-muted)] px-3 py-1.5 text-xs font-medium text-[var(--to-foreground)]"
          >
            Org · {orgLabel}
          </button>

          <button
            type="button"
            className="rounded-full border border-[var(--to-border)] px-3 py-1.5 text-xs font-medium text-[var(--to-foreground)]"
          >
            Current FM
          </button>

          <button
            type="button"
            className="rounded-full border border-[var(--to-border)] px-3 py-1.5 text-xs font-medium text-[var(--to-foreground)]"
          >
            {
              PRESET_LABELS[
                activePreset
              ]
            } Workspace
          </button>

          <div className="mx-1 hidden h-6 w-px bg-[var(--to-border)] md:block" />

          <div className="relative">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPresetMenuOpen(
                  (v) => !v,
                );
              }}
            >
              Workspace Presets
            </Button>

            {presetMenuOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-[var(--to-border)] bg-[var(--to-card)] p-2 shadow-xl">
                {(
                  Object.keys(
                    PRESET_LABELS,
                  ) as PresetKey[]
                ).map((preset) => {
                  const active =
                    preset === activePreset;

                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        props.onPresetChange?.(
                          preset,
                        );

                        setPresetMenuOpen(
                          false,
                        );
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[var(--to-row-hover)] ${
                        active
                          ? "bg-[var(--to-card-muted)] font-medium"
                          : ""
                      }`}
                    >
                      <span>
                        {
                          PRESET_LABELS[
                            preset
                          ]
                        }
                      </span>

                      {active ? (
                        <span className="text-xs text-[var(--to-muted)]">
                          Active
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {props.hasUnsavedPreview ? (
            <Button
              type="button"
              variant="secondary"
              onClick={props.onSaveWorkspace}
            >
              Save Workspace
            </Button>
          ) : null}

          {props.hasSavedWorkspace ? (
            <Button
              type="button"
              variant="secondary"
              onClick={props.onResetWorkspace}
            >
              Reset Workspace
            </Button>
          ) : null}

          <Button
            type="button"
            onClick={props.onEditLayout}
          >
            Edit Layout
          </Button>
        </div>
      </div>
    </div>
  );
}
