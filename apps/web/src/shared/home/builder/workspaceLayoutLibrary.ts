import type {
  WorkspaceLayoutPreview,
} from "./workspaceBuilder.types";

const MAIN_WIDGETS = [
  "metrics_snapshot",
  "workforce_snapshot",
  "route_lock_snapshot",
  "dispatch_snapshot",
] as const;

export const workspaceLayoutLibrary: WorkspaceLayoutPreview[] = [
  {
    id: "wide-stack",
    label: "Wide Stack",
    description: "Three full-width rows.",
    rows: [
      {
        id: "row-1",
        slots: [{ id: "main-1", size: "wide", allowedWidgets: [...MAIN_WIDGETS] }],
      },
      {
        id: "row-2",
        slots: [{ id: "main-2", size: "wide", allowedWidgets: [...MAIN_WIDGETS] }],
      },
      {
        id: "row-3",
        slots: [{ id: "main-3", size: "wide", allowedWidgets: [...MAIN_WIDGETS] }],
      },
    ],
  },
  {
    id: "medium-stack",
    label: "Medium Stack",
    description: "Two-column operating rhythm.",
    rows: [
      {
        id: "row-1",
        slots: [
          { id: "main-1", size: "medium", allowedWidgets: [...MAIN_WIDGETS] },
          { id: "main-2", size: "medium", allowedWidgets: [...MAIN_WIDGETS] },
        ],
      },
      {
        id: "row-2",
        slots: [
          { id: "main-3", size: "medium", allowedWidgets: [...MAIN_WIDGETS] },
          { id: "main-4", size: "medium", allowedWidgets: [...MAIN_WIDGETS] },
        ],
      },
    ],
  },
  {
    id: "metrics-focus",
    label: "Metrics Focus",
    description: "Wide / split / wide review flow.",
    rows: [
      {
        id: "row-1",
        slots: [{ id: "main-1", size: "wide", allowedWidgets: ["metrics_snapshot"] }],
      },
      {
        id: "row-2",
        slots: [
          { id: "main-2", size: "medium", allowedWidgets: [...MAIN_WIDGETS] },
          { id: "main-3", size: "medium", allowedWidgets: [...MAIN_WIDGETS] },
        ],
      },
      {
        id: "row-3",
        slots: [{ id: "main-4", size: "wide", allowedWidgets: [...MAIN_WIDGETS] }],
      },
    ],
  },
  {
    id: "custom",
    label: "Custom Layout",
    description: "Build from scratch.",
    rows: [],
  },
];
