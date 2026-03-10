import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const createdByUserId = req.nextUrl.searchParams.get("createdByUserId")?.trim();

  if (!createdByUserId) {
    return badRequest("createdByUserId is required.");
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_get_my_submissions", {
    p_created_by_user_id: createdByUserId,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to load my Field Log submissions." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}