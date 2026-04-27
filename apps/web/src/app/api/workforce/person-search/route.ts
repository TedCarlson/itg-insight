// path: apps/web/src/app/api/workforce/person-search/route.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export async function GET(req: Request) {
  const sb = await supabaseAdmin();

  const { searchParams } = new URL(req.url);

  const pc_org_id = searchParams.get("pc_org_id");
  const q = searchParams.get("q");

  if (!pc_org_id) {
    return NextResponse.json(
      { error: "Missing pc_org_id" },
      { status: 400 }
    );
  }

  const { data, error } = await sb.rpc("workforce_person_search", {
    p_pc_org_id: pc_org_id,
    p_query: q ?? null,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    rows: data ?? [],
  });
}