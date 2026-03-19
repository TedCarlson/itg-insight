import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

function forbidden(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export async function GET(_req: NextRequest) {
  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return forbidden("Unauthorized.");
  }

  const { data, error } = await supabase.rpc("field_log_get_my_submissions", {
    p_created_by_user_id: String(user.id),
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to load my Field Log submissions.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: data ?? [],
  });
}