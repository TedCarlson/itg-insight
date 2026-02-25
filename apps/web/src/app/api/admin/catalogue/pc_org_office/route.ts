import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function boolish(v: unknown, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(s)) return true;
    if (["false", "0", "no", "n", "off"].includes(s)) return false;
  }
  return fallback;
}

export async function GET(req: NextRequest) {
  // signed-in gate
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const pageIndex = Math.max(0, num(url.searchParams.get("pageIndex"), 0));
  const pageSizeRaw = num(url.searchParams.get("pageSize"), 25);
  const pageSize = Math.min(100, Math.max(5, pageSizeRaw));

  const from = pageIndex * pageSize;
  const to = from + pageSize - 1;

  const admin = supabaseAdmin();

  // Keep select comment-free (PostgREST parsing).
  // Assumes pc_org_office has: pc_org_office_id, pc_org_id, office_id, is_primary, office_notes
  // Assumes pc_org has: pc_org_name
  // Assumes office has: office_name  (NO office_code)
  const select = `
    pc_org_office_id,
    pc_org_id,
    office_id,
    is_primary,
    office_notes,

    pc_org:pc_org_id (
      pc_org_id,
      pc_org_name
    ),

    office:office_id (
      office_id,
      office_name
    )
  `;

  let query = admin
    .from("pc_org_office")
    .select(select, { count: "exact" })
    .order("pc_org_office_id", { ascending: true })
    .range(from, to);

  if (q) {
    // Fast + predictable: search embedded names (works because we return them).
    // If your PostgREST doesn’t allow searching embedded aliases, swap to:
    //   query = query.or(`pc_org_id.eq.${q},office_id.eq.${q}`)
    query = query.or(`pc_org.pc_org_name.ilike.%${q}%,office.office_name.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows =
    (data ?? []).map((r: any) => ({
      pc_org_office_id: r.pc_org_office_id,
      pc_org_id: r.pc_org_id ?? null,
      office_id: r.office_id ?? null,

      is_primary: r.is_primary ?? false,
      office_notes: r.office_notes ?? null,

      pc_org_name: r.pc_org?.pc_org_name ?? null,
      office_name: r.office?.office_name ?? null,
    })) ?? [];

  return NextResponse.json({
    rows,
    page: { pageIndex, pageSize, totalRows: count ?? undefined },
  });
}

export async function POST(req: NextRequest) {
  // signed-in gate
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      pc_org_id?: unknown;
      office_id?: unknown;
      is_primary?: unknown;
      office_notes?: unknown;
    };

    const pc_org_id = body.pc_org_id == null ? "" : String(body.pc_org_id).trim();
    const office_id = body.office_id == null ? "" : String(body.office_id).trim();

    if (!pc_org_id) return NextResponse.json({ error: "pc_org_id is required" }, { status: 400 });
    if (!office_id) return NextResponse.json({ error: "office_id is required" }, { status: 400 });

    const is_primary = boolish(body.is_primary, false);
    const office_notes =
      body.office_notes == null ? null : String(body.office_notes).trim() || null;

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("pc_org_office")
      .insert({ pc_org_id, office_id, is_primary, office_notes })
      .select("pc_org_office_id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: data?.pc_org_office_id ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}