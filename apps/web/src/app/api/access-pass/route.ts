import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();

    // Signed-in gate (critical: ensures the cookie session exists)
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const pcOrgId = String(url.searchParams.get("pc_org_id") ?? "").trim();

    if (!pcOrgId || !isUuid(pcOrgId)) {
      return NextResponse.json({ error: "Invalid pc_org_id" }, { status: 400 });
    }

    // IMPORTANT:
    // Call PUBLIC wrapper so we don't care about schema search_path on the RPC name.
    // (Your public.get_access_pass delegates to api.get_access_pass.)
    const { data, error } = await supabase.rpc("get_access_pass", {
      p_pc_org_id: pcOrgId,
    });

    if (error) {
      // Return the real Postgres/Supabase error to the client.
      // This prevents “mystery 400” and tells us exactly what failed.
      return NextResponse.json(
        {
          error: {
            code: error.code ?? null,
            message: error.message ?? "RPC error",
            details: (error as any).details ?? null,
            hint: (error as any).hint ?? null,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(data ?? null, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: { message: e?.message ?? "Server error" } },
      { status: 500 }
    );
  }
}