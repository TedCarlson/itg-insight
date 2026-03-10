import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_runtime_bootstrap");

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to load Field Log runtime bootstrap.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data,
  });
}