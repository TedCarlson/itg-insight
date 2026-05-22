import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";
import { loadDefaultWorkspace } from "@/shared/home/server/workspaces/workspaceService";

export const runtime = "nodejs";

export async function GET(req: Request) {
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

    const url = new URL(req.url);

    const role =
      url.searchParams.get("role") ??
      "COMPANY_MANAGER";

    const pcOrgId =
      url.searchParams.get("pc_org_id");

    const workspace =
      await loadDefaultWorkspace({
        supabase: supabaseAdmin(),
        auth_user_id: user.id,
        role,
        pc_org_id: pcOrgId,
      });

    return NextResponse.json({
      ok: true,
      workspace,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "workspace_load_failed",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}
