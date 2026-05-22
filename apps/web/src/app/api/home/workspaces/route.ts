import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";
import { saveWorkspace } from "@/shared/home/server/workspaces/workspaceService";

import type {
  SaveWorkspaceInput,
  WorkspaceRailMode,
  WorkspaceRailPosition,
  WorkspaceScreenPreset,
  WorkspaceStructureId,
} from "@/shared/home/contracts/workspace.types";

export const runtime = "nodejs";

const VALID_STRUCTURE_IDS = [
  "wide-stack",
  "medium-stack",
  "metrics-focus",
  "mixed-stack",
  "custom",
  "my_layout",
] as const;

const VALID_RAIL_MODES: WorkspaceRailMode[] = [
  "off",
  "half",
  "full",
];

const VALID_RAIL_POSITIONS: WorkspaceRailPosition[] = [
  "left",
  "right",
];

const VALID_SCREEN_PRESETS: WorkspaceScreenPreset[] = [
  "laptop_14",
  "desktop_27",
  "workspace_32",
  "ultrawide",
];

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSaveWorkspaceInput(body: unknown): SaveWorkspaceInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const workspaceName = String(body.workspace_name ?? "").trim();
  const runtimeConfig = body.runtime_config;

  if (!workspaceName || !isRecord(runtimeConfig)) {
    return null;
  }

  if (!VALID_STRUCTURE_IDS.includes(runtimeConfig.structure_id as WorkspaceStructureId)) {
    return null;
  }

  if (!VALID_RAIL_MODES.includes(runtimeConfig.rail_mode as WorkspaceRailMode)) {
    return null;
  }

  if (!VALID_RAIL_POSITIONS.includes(runtimeConfig.rail_position as WorkspaceRailPosition)) {
    return null;
  }

  if (!VALID_SCREEN_PRESETS.includes(runtimeConfig.screen_preset as WorkspaceScreenPreset)) {
    return null;
  }

  if (!Array.isArray(runtimeConfig.widget_assignments)) {
    return null;
  }

  return {
    workspace_name: workspaceName,
    is_default: body.is_default === true,
    runtime_config: {
      structure_id: runtimeConfig.structure_id as WorkspaceStructureId,
      rail_mode: runtimeConfig.rail_mode as WorkspaceRailMode,
      rail_position: runtimeConfig.rail_position as WorkspaceRailPosition,
      screen_preset: runtimeConfig.screen_preset as WorkspaceScreenPreset,
      widget_assignments: runtimeConfig.widget_assignments as SaveWorkspaceInput["runtime_config"]["widget_assignments"],
    },
  };
}

export async function POST(req: Request) {
  try {
    const userClient = await supabaseServer();

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => null);
    const input = parseSaveWorkspaceInput(body);

    if (!input) {
      return NextResponse.json(
        { ok: false, error: "invalid_workspace_payload" },
        { status: 400 },
      );
    }

    const role = String((body as Record<string, unknown>)?.role ?? "COMPANY_MANAGER");
    const pcOrgIdRaw = (body as Record<string, unknown>)?.pc_org_id;
    const pcOrgId =
      pcOrgIdRaw === null || pcOrgIdRaw === undefined || String(pcOrgIdRaw).trim() === ""
        ? null
        : String(pcOrgIdRaw).trim();

    const saved = await saveWorkspace({
      supabase: supabaseAdmin(),
      auth_user_id: user.id,
      role,
      pc_org_id: pcOrgId,
      input,
    });

    return NextResponse.json(
      { ok: true, workspace: saved },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "workspace_save_failed",
        details: serializeError(error),
      },
      { status: 500 },
    );
  }
}
