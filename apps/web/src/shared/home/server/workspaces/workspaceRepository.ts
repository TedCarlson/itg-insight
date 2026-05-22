import type {
  SupabaseClient,
} from "@/shared/data/supabase/types";

import type {
  SaveWorkspaceInput,
  WorkspacePreferenceRecord,
} from "@/shared/home/contracts/workspace.types";

type SaveWorkspaceArgs = {
  supabase: SupabaseClient;
  auth_user_id: string;
  role: string;
  pc_org_id: string | null;
  input: SaveWorkspaceInput;
};

export async function saveWorkspacePreference(
  args: SaveWorkspaceArgs,
): Promise<WorkspacePreferenceRecord> {
  const { data, error } = await args.supabase
    .schema("api")
    .from("home_workspace_preference")
    .upsert(
      {
        auth_user_id: args.auth_user_id,
        role: args.role,
        pc_org_id: args.pc_org_id,
        workspace_name: args.input.workspace_name,
        is_default: true,
        runtime_config: args.input.runtime_config,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "auth_user_id,role,scope_key",
      },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(JSON.stringify(error));
  }

  return data as WorkspacePreferenceRecord;
}

type ListWorkspaceArgs = {
  supabase: SupabaseClient;
  auth_user_id: string;
  role: string;
  pc_org_id: string | null;
};

export async function listWorkspacePreferences(
  args: ListWorkspaceArgs,
): Promise<WorkspacePreferenceRecord[]> {
  if (args.pc_org_id) {
    const scoped = await args.supabase
      .schema("api")
      .from("home_workspace_preference")
      .select("*")
      .eq("auth_user_id", args.auth_user_id)
      .eq("role", args.role)
      .eq("pc_org_id", args.pc_org_id)
      .order("updated_at", { ascending: false });

    if (scoped.error) {
      throw new Error(JSON.stringify(scoped.error));
    }

    if (scoped.data.length > 0) {
      return scoped.data as WorkspacePreferenceRecord[];
    }
  }

  const fallback = await args.supabase
    .schema("api")
    .from("home_workspace_preference")
    .select("*")
    .eq("auth_user_id", args.auth_user_id)
    .eq("role", args.role)
    .order("updated_at", { ascending: false });

  if (fallback.error) {
    throw new Error(JSON.stringify(fallback.error));
  }

  return fallback.data as WorkspacePreferenceRecord[];
}
