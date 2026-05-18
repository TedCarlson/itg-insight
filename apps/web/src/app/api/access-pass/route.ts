// Path: apps/web/src/app/api/access-pass/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const pcOrgId = String(req.nextUrl.searchParams.get("pc_org_id") ?? "").trim();

    if (!pcOrgId || !isUuid(pcOrgId)) {
      return NextResponse.json({ error: "invalid_pc_org_id" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("get_access_pass", {
      p_pc_org_id: pcOrgId,
    });

    if (error || !data) {
      return NextResponse.json(
        {
          error: "access_pass_failed",
          supabase: error
            ? {
                code: error.code ?? null,
                message: error.message ?? null,
                details: (error as any).details ?? null,
                hint: (error as any).hint ?? null,
              }
            : null,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "server_error", details: e?.message ?? null },
      { status: 500 }
    );
  }
}