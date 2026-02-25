import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const pc_org_id = req.nextUrl.searchParams.get("pc_org_id") ?? "";

  if (!pc_org_id) {
    return NextResponse.json({ ok: false, error: "missing_pc_org_id" }, { status: 400 });
  }

  const sb = await supabaseServer();

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // This runs with the user's JWT, so auth.uid() is real.
  const access = await sb.rpc("has_dispatch_console_access", { p_pc_org_id: pc_org_id });

  if (access.error) {
    return NextResponse.json(
      { ok: false, error: "rpc_failed", details: access.error, auth_uid: user.id },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    auth_uid: user.id,
    pc_org_id,
    has_dispatch_access: Boolean(access.data),
  });
}