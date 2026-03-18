import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from("metrics_color_preset")
      .select("preset_key")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      activePresetKey: data?.preset_key ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load preset" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const preset_key = body?.preset_key;

    if (!preset_key) {
      return NextResponse.json(
        { error: "preset_key required" },
        { status: 400 }
      );
    }

    const sb = supabaseAdmin();

    // deactivate all
    await sb.from("metrics_color_preset").update({ is_active: false }).neq("preset_key", "");

    // upsert selected
    const { error } = await sb
      .from("metrics_color_preset")
      .upsert(
        { preset_key, is_active: true },
        { onConflict: "preset_key" }
      );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to save preset" },
      { status: 500 }
    );
  }
}