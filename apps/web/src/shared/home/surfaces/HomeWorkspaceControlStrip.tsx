"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

import type {
  HomeSurfacePayload,
} from "../contracts/home.types";

type LayoutMode =
  | "default"
  | "my_layout";

const LAYOUT_LABELS: Record<
  LayoutMode,
  string
> = {
  default: "Default",
  my_layout: "My Layout",
};

function formatRole(role: string) {
  return role.replaceAll("_", " ");
}

export function HomeWorkspaceControlStrip(props: {
  payload: HomeSurfacePayload;
  activeLayoutMode?: LayoutMode;
  onLayoutModeChange?: (
    mode: LayoutMode,
  ) => void;
  onEditLayout?: () => void;
  onResetWorkspace?: () => void;
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

  const activeLayoutMode =
    props.activeLayoutMode ?? "default";

  const workspaceLabel =
    activeLayoutMode === "my_layout"
      ? "My Layout"
      : "Default Workspace";

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
              · {workspaceLabel}
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
            {workspaceLabel}
          </button>

          <div className="mx-1 hidden h-6 w-px bg-[var(--to-border)] md:block" />

          <div className="relative">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPresetMenuOpen(
                  (value) => !value,
                );
              }}
            >
              Workspace Layout
            </Button>

            {presetMenuOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-slate-300 bg-white p-2 shadow-2xl ring-1 ring-slate-200">
                {(
                  Object.keys(
                    LAYOUT_LABELS,
                  ) as LayoutMode[]
                ).map((mode) => {
                  const active =
                    mode === activeLayoutMode;

                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        props.onLayoutModeChange?.(
                          mode,
                        );

                        setPresetMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[var(--to-row-hover)] ${
                        active
                          ? "bg-[var(--to-card-muted)] font-medium"
                          : ""
                      }`}
                    >
                      <span>
                        {LAYOUT_LABELS[mode]}
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
