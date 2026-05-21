import type { HomeLayoutConfig } from "../contracts/home.types";

import { managerHomeDefault } from "./managerHomeDefault";
import { managerHomeMetrics } from "./presets/managerHomeMetrics";
import { managerHomeOperations } from "./presets/managerHomeOperations";
import { managerHomePeople } from "./presets/managerHomePeople";

export const presetRegistry = {
  default: managerHomeDefault,
  operations: managerHomeOperations,
  people: managerHomePeople,
  metrics: managerHomeMetrics,
} satisfies Record<string, HomeLayoutConfig>;

export type WorkspacePresetKey =
  keyof typeof presetRegistry;

export function resolveWorkspacePreset(
  preset: WorkspacePresetKey,
) {
  return (
    presetRegistry[preset] ??
    presetRegistry.default
  );
}
