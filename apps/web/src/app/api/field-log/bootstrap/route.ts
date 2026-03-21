import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RuntimeBootstrapRow = {
  config?: unknown;
  categories?: unknown[];
  subcategories?: unknown[];
  rules?: unknown[];
  ucodes?: unknown[];
};

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function GET() {
  try {
    const supabase = supabaseAdmin();

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

    const row = (data ?? {}) as RuntimeBootstrapRow;

    return NextResponse.json({
      ok: true,
      data: {
        config: row.config ?? null,
        categories: asArray(row.categories),
        subcategories: asArray(row.subcategories),
        rules: asArray(row.rules),
        ucodes: asArray(row.ucodes),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown bootstrap error",
      },
      { status: 500 },
    );
  }
}