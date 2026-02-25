import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: { table: string } } | { params: Promise<{ table: string }> };

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function getParams(ctx: Ctx): Promise<{ table: string }> {
  // supports both Next variants (sync params or Promise params)
  const p: any = (ctx as any).params;
  return typeof p?.then === "function" ? await p : p;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { table } = await getParams(ctx);

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, num(url.searchParams.get("limit"), 50)));

  const admin = supabaseAdmin();
  const { data, error } = await admin.from(table).select("*").limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // columns from first row (lightweight)
  const first = (data ?? [])[0] ?? {};
  const columns = Object.keys(first).map((k) => ({
    key: k,
    label: k,
    type: typeof (first as any)[k],
    editable: true,
    readonlyReason: undefined as string | undefined,
  }));

  return NextResponse.json({ columns, rows: data ?? [] });
}