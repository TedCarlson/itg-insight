"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";

import {
  workspaceLayoutLibrary,
} from "./workspaceLayoutLibrary";

import type {
  WorkspaceLayoutPreview,
  WorkspaceRailMode,
  WorkspaceRailPosition,
  WorkspaceScreenPreset,
  WorkspaceSlot,
} from "./workspaceBuilder.types";

import type {
  HomeLayoutConfig,
} from "../contracts/home.types";

import type {
  HomeWidgetKind,
} from "@/shared/widgets/contracts/widget.types";

type AssignedWidgets = Record<string, HomeWidgetKind>;

const RAIL_WIDGETS = [
  "activity_feed",
  "dispatch_snapshot",
] as const;

const SCREEN_OPTIONS: Array<{
  id: WorkspaceScreenPreset;
  label: string;
}> = [
  { id: "laptop_14", label: '14" Laptop' },
  { id: "desktop_27", label: '27" Desktop' },
  { id: "workspace_32", label: '32" Workspace' },
  { id: "ultrawide", label: "Ultrawide" },
];

const RAIL_MODE_OPTIONS: Array<{
  id: WorkspaceRailMode;
  label: string;
}> = [
  { id: "off", label: "Rail Off" },
  { id: "half", label: "Half Rail" },
  { id: "full", label: "Full Rail" },
];

const RAIL_POSITION_OPTIONS: Array<{
  id: WorkspaceRailPosition;
  label: string;
}> = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
];

function mainSlotClass(slot: WorkspaceSlot) {
  switch (slot.size) {
    case "small":
      return "col-span-4";

    case "medium":
      return "col-span-6";

    case "wide":
    default:
      return "col-span-12";
  }
}

function railSlotSize(
  railMode: WorkspaceRailMode,
): WorkspaceSlot["size"] {
  if (railMode === "full") {
    return "rail_full";
  }

  return "rail_half";
}

function buildSlots(
  layout: WorkspaceLayoutPreview,
  railMode: WorkspaceRailMode,
): WorkspaceSlot[] {
  const mainSlots: WorkspaceSlot[] =
    layout.rows.flatMap((row) => {
      return row.slots.map((slot) => {
        return {
          id: slot.id,
          zone: "main",
          size: slot.size,
          allowedWidgets: slot.allowedWidgets,
        };
      });
    });

  if (railMode === "off") {
    return mainSlots;
  }

  return [
    ...mainSlots,
    {
      id: "rail-1",
      zone: "rail",
      size: railSlotSize(railMode),
      allowedWidgets: [...RAIL_WIDGETS],
    },
  ];
}

function renderAssignedLabel(
  assigned: string | undefined,
) {
  if (!assigned) return null;

  return assigned
    .replaceAll("_", " ")
    .replace(/\b\w/g, (value) =>
      value.toUpperCase(),
    );
}

function renderSlot(
  slot: WorkspaceSlot,
  assignedWidgets: AssignedWidgets,
) {
  const assigned =
    assignedWidgets[slot.id];

  return (
    <div
      key={slot.id}
      className={`rounded-2xl border border-dashed border-[var(--to-border)] bg-[var(--to-card)] p-3 ${
        slot.zone === "main"
          ? mainSlotClass(slot)
          : ""
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--to-muted)]">
        {slot.zone} · {slot.size}
      </div>

      <div className="mt-2">
        {assigned ? (
          <div className="rounded-xl border border-[var(--to-border)] bg-[var(--to-card-muted)] p-6">
            <div className="text-sm font-medium text-[var(--to-foreground)]">
              {renderAssignedLabel(
                assigned,
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-[var(--to-border)] text-sm text-[var(--to-muted)]">
            + Add Widget
          </div>
        )}
      </div>
    </div>
  );
}

function OptionButton<T extends string>(props: {
  active: boolean;
  value: T;
  label: string;
  onSelect: (value: T) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        props.onSelect(props.value);
      }}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        props.active
          ? "border-[var(--to-focus)] bg-[var(--to-card-muted)] text-[var(--to-foreground)]"
          : "border-[var(--to-border)] text-[var(--to-muted)] hover:bg-[var(--to-row-hover)]"
      }`}
    >
      {props.label}
    </button>
  );
}

function ThumbnailSlot(props: {
  size: WorkspaceSlot["size"];
}) {
  return (
    <div
      className={`rounded bg-[var(--to-border)] ${
        props.size === "small"
          ? "col-span-4"
          : props.size === "medium"
          ? "col-span-6"
          : "col-span-12"
      }`}
    />
  );
}

function LayoutThumbnail(props: {
  layout: WorkspaceLayoutPreview;
  railMode: WorkspaceRailMode;
  railPosition: WorkspaceRailPosition;
}) {
  const hasRail =
    props.railMode !== "off";

  const main = (
    <div
      className={
        hasRail
          ? "col-span-9 space-y-1"
          : "col-span-12 space-y-1"
      }
    >
      {props.layout.rows.map((row) => {
        return (
          <div
            key={row.id}
            className="grid h-4 grid-cols-12 gap-1"
          >
            {row.slots.map((slot) => {
              return (
                <ThumbnailSlot
                  key={slot.id}
                  size={slot.size}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );

  const rail = hasRail ? (
    <div
      className={`col-span-3 rounded bg-[var(--to-border)] ${
        props.railMode === "half"
          ? "h-1/2"
          : "h-full"
      }`}
    />
  ) : null;

  return (
    <div className="mt-2 h-16 rounded-xl border border-[var(--to-border)] bg-[var(--to-card)] p-2">
      <div className="grid h-full grid-cols-12 gap-1">
        {props.railPosition === "left"
          ? rail
          : null}
        {main}
        {props.railPosition === "right"
          ? rail
          : null}
      </div>
    </div>
  );
}

export function WorkspaceBuilderPreview(props: {
  onApplyLayout?: (layout: HomeLayoutConfig) => void;
}) {
  const [
    activeLayoutId,
    setActiveLayoutId,
  ] = useState("wide-stack");

  const [
    railMode,
    setRailMode,
  ] =
    useState<WorkspaceRailMode>(
      "full",
    );

  const [
    railPosition,
    setRailPosition,
  ] =
    useState<WorkspaceRailPosition>(
      "right",
    );

  const [
    screenPreset,
    setScreenPreset,
  ] =
    useState<WorkspaceScreenPreset>(
      "workspace_32",
    );

  const layout =
    useMemo(() => {
      return (
        workspaceLayoutLibrary.find(
          (x) =>
            x.id ===
            activeLayoutId,
        ) ??
        workspaceLayoutLibrary[0]
      );
    }, [activeLayoutId]);

  const slots =
    useMemo(() => {
      return buildSlots(
        layout,
        railMode,
      );
    }, [layout, railMode]);

  const [
    assignedWidgets,
    setAssignedWidgets,
  ] = useState<AssignedWidgets>({});

  const mainSlots =
    slots.filter(
      (x) => x.zone === "main",
    );

  const railSlots =
    slots.filter(
      (x) => x.zone === "rail",
    );

  const canvasClass =
    screenPreset === "laptop_14"
      ? "aspect-[10/16] max-w-[900px]"
      : screenPreset === "desktop_27"
      ? "aspect-[16/10]"
      : screenPreset === "ultrawide"
      ? "aspect-[21/9]"
      : "aspect-[16/10]";

  function assignWidget(
    slotId: string,
    widget: HomeWidgetKind,
  ) {
    setAssignedWidgets((prev) => {
      return {
        ...prev,
        [slotId]: widget,
      };
    });
  }

  function buildAppliedLayout(): HomeLayoutConfig {
    const mainWidgets =
      layout.rows.flatMap((row) => {
        return row.slots.flatMap((slot) => {
          const assigned =
            assignedWidgets[slot.id];

          if (!assigned) {
            return [];
          }

          return [
            {
              id: slot.id,
              kind: assigned,
              title:
                renderAssignedLabel(assigned) ??
                assigned,
              size: slot.size,
              zone: "main" as const,
            },
          ];
        });
      });

    const railWidgets =
      railSlots.flatMap((slot) => {
        const assigned =
          assignedWidgets[slot.id];

        if (!assigned) {
          return [];
        }

        return [
          {
            id: slot.id,
            kind: assigned,
            title:
              renderAssignedLabel(assigned) ??
              assigned,
            size: slot.size,
            zone: "rail" as const,
          },
        ];
      });

    return {
      id: `custom-${layout.id}`,
      role: "COMPANY_MANAGER",
      label: `${layout.label} Preview`,
      sections: [
        {
          id: "main",
          title: "Main",
          widgets: mainWidgets,
        },
        ...(railWidgets.length > 0
          ? [
              {
                id: "rail",
                title: "Rail",
                widgets: railWidgets,
              },
            ]
          : []),
      ],
    };
  }

  const hasAssignedWidgets =
    Object.keys(assignedWidgets).length > 0;

  const availableWidgets =
    Array.from(
      new Set(
        slots.flatMap((slot) => {
          return slot.allowedWidgets;
        }),
      ),
    );

  const mainCanvas = (
    <div
      className={
        railMode === "off"
          ? "col-span-12"
          : "col-span-9"
      }
    >
      {layout.rows.length === 0 ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-[var(--to-border)] text-sm text-[var(--to-muted)]">
          Custom layout builder placeholder
        </div>
      ) : (
      <div className="space-y-4">
        {layout.rows.map((row) => {
          return (
            <div
              key={row.id}
              className="grid grid-cols-12 gap-4"
            >
              {row.slots.map((slotDef) => {
                const slot =
                  mainSlots.find(
                    (candidate) =>
                      candidate.id ===
                      slotDef.id,
                  );

                if (!slot) {
                  return null;
                }

                return renderSlot(
                  slot,
                  assignedWidgets,
                );
              })}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );

  const railCanvas =
    railSlots.length > 0 ? (
      <div className="col-span-3">
        <div
          className={`flex ${
            railMode === "full"
              ? "h-full"
              : "h-1/2"
          } flex-col gap-4 rounded-2xl border border-[var(--to-border)] bg-[var(--to-card-muted)] p-3`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--to-muted)]">
            Workspace Rail
          </div>

          <div className="space-y-3">
            {railSlots.map((slot) => {
              return renderSlot(
                slot,
                assignedWidgets,
              );
            })}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-muted)]">
            Layouts
          </div>

          <div className="mt-3 space-y-3">
            {workspaceLayoutLibrary.map(
              (candidate) => {
                const active =
                  candidate.id ===
                  activeLayoutId;

                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      setActiveLayoutId(
                        candidate.id,
                      );

                      setAssignedWidgets(
                        {},
                      );
                    }}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-[var(--to-focus)] bg-[var(--to-card-muted)] shadow-sm"
                        : "border-[var(--to-border)] hover:bg-[var(--to-row-hover)]"
                    }`}
                  >
                    <div className="text-sm font-medium">
                      {candidate.label}
                    </div>

                    <LayoutThumbnail
                      layout={
                        candidate
                      }
                      railMode={
                        railMode
                      }
                      railPosition={
                        railPosition
                      }
                    />
                  </button>
                );
              },
            )}
          </div>
        </div>
      </div>

      <div className="xl:col-span-7">
        <div className="rounded-[28px] border border-[var(--to-border)] bg-[var(--to-card)] p-5 shadow-sm">
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-muted)]">
                  Workspace Canvas
                </div>

                <div className="mt-1 text-sm text-[var(--to-muted)]">
                  Live workspace simulation
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {SCREEN_OPTIONS.map(
                  (item) => {
                    return (
                      <OptionButton
                        key={item.id}
                        active={
                          item.id ===
                          screenPreset
                        }
                        value={item.id}
                        label={
                          item.label
                        }
                        onSelect={
                          setScreenPreset
                        }
                      />
                    );
                  },
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--to-border)] bg-[var(--to-card-muted)] px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                {RAIL_MODE_OPTIONS.map(
                  (item) => {
                    return (
                      <OptionButton
                        key={item.id}
                        active={
                          item.id ===
                          railMode
                        }
                        value={item.id}
                        label={
                          item.label
                        }
                        onSelect={
                          setRailMode
                        }
                      />
                    );
                  },
                )}
              </div>

              {railMode !== "off" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-[var(--to-muted)]">
                    Rail position
                  </span>

                  {RAIL_POSITION_OPTIONS.map(
                    (item) => {
                      return (
                        <OptionButton
                          key={item.id}
                          active={
                            item.id ===
                            railPosition
                          }
                          value={
                            item.id
                          }
                          label={
                            item.label
                          }
                          onSelect={
                            setRailPosition
                          }
                        />
                      );
                    },
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div
            className={`mx-auto rounded-2xl border border-[var(--to-border)] bg-[var(--to-app-bg)] p-4 transition-all ${canvasClass}`}
          >
            <div className="grid h-full grid-cols-12 gap-4">
              {railPosition === "left"
                ? railCanvas
                : null}
              {mainCanvas}
              {railPosition === "right"
                ? railCanvas
                : null}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 xl:col-span-3">
        <div className="rounded-2xl border border-[var(--to-border)] bg-[var(--to-card)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-muted)]">
            Widget Library
          </div>

          <div className="mt-3 space-y-2">
            {availableWidgets.map(
              (widget) => {
                return (
                  <button
                    key={widget}
                    type="button"
                    onClick={() => {
                      const emptySlot =
                        slots.find(
                          (slot) =>
                            !assignedWidgets[
                              slot.id
                            ] &&
                            slot.allowedWidgets.includes(
                              widget,
                            ),
                        );

                      if (
                        !emptySlot
                      ) {
                        return;
                      }

                      assignWidget(
                        emptySlot.id,
                        widget,
                      );
                    }}
                    className="w-full rounded-xl border border-[var(--to-border)] bg-[var(--to-card)] px-3 py-3 text-left transition hover:bg-[var(--to-row-hover)]"
                  >
                    <div className="text-sm font-medium">
                      {renderAssignedLabel(
                        widget,
                      )}
                    </div>

                    <div className="mt-1 text-xs text-[var(--to-muted)]">
                      Assign to compatible slot
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </div>

        <Card className="space-y-4 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-muted)]">
              Builder Notes
            </div>

            <div className="mt-2 text-sm text-[var(--to-muted)]">
              Presets define structure. Rail mode, rail position, and screen simulation are ergonomic modifiers.
            </div>
          </div>

          <button
            type="button"
            disabled={!hasAssignedWidgets}
            onClick={() => {
              props.onApplyLayout?.(
                buildAppliedLayout(),
              );
            }}
            className="w-full rounded-xl border border-blue-700 bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100"
          >
            Apply Preview to Home
          </button>
        </Card>
      </div>
    </div>
  );
}
