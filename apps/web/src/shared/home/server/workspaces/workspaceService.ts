import type {
  SupabaseClient,
} from "@/shared/data/supabase/types";

import type {
  SaveWorkspaceInput,
  WorkspacePreferenceRecord,
} from "@/shared/home/contracts/workspace.types";

import {
  listWorkspacePreferences,
  saveWorkspacePreference,
} from "./workspaceRepository";

type SaveWorkspaceServiceArgs = {
  supabase: SupabaseClient;

  auth_user_id: string;

  role: string;

  pc_org_id: string | null;

  input: SaveWorkspaceInput;
};

export async function saveWorkspace(
  args: SaveWorkspaceServiceArgs,
): Promise<WorkspacePreferenceRecord> {
  if (
    args.input.is_default
  ) {
    await clearExistingDefaults({
      supabase: args.supabase,
      auth_user_id:
        args.auth_user_id,
      role: args.role,
      pc_org_id:
        args.pc_org_id,
    });
  }

  return saveWorkspacePreference(
    {
      supabase: args.supabase,

      auth_user_id:
        args.auth_user_id,

      role: args.role,

      pc_org_id:
        args.pc_org_id,

      input: args.input,
    },
  );
}

type ClearDefaultsArgs = {
  supabase: SupabaseClient;

  auth_user_id: string;

  role: string;

  pc_org_id: string | null;
};

async function clearExistingDefaults(
  args: ClearDefaultsArgs,
) {
  const query =
    args.supabase
      .schema("api")
      .from(
        "home_workspace_preference",
      )
      .update({
        is_default: false,
      })
      .eq(
        "auth_user_id",
        args.auth_user_id,
      )
      .eq("role", args.role);

  if (args.pc_org_id) {
    query.eq(
      "pc_org_id",
      args.pc_org_id,
    );
  }

  const { error } =
    await query;

  if (error) {
    throw new Error(JSON.stringify(error));
  }
}

type LoadDefaultWorkspaceArgs =
  {
    supabase: SupabaseClient;

    auth_user_id: string;

    role: string;

    pc_org_id: string | null;
  };

export async function loadDefaultWorkspace(
  args: LoadDefaultWorkspaceArgs,
): Promise<
  WorkspacePreferenceRecord | null
> {
  const workspaces =
    await listWorkspacePreferences(
      {
        supabase: args.supabase,

        auth_user_id:
          args.auth_user_id,

        role: args.role,

        pc_org_id:
          args.pc_org_id,
      },
    );

  return (
    workspaces.find(
      (x) => x.is_default,
    ) ?? null
  );
}
