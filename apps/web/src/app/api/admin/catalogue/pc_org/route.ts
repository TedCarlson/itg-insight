import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function strOrNull(v: unknown) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export async function GET(req: NextRequest) {
  // signed-in gate (service role remains server-only)
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

  // IMPORTANT:
  // No SQL-style comments inside the select string — PostgREST will choke.
  const select = `
    pc_org_id,
    pc_org_name,
    pc_id,
    mso_id,
    division_id,
    region_id,
    state_code,
    fulfillment_center_id,
    fulfillment_center_name,

    pc:pc_id (
      pc_id,
      pc_number
    ),

    mso:mso!pc_org_mso_id_fkey (
      mso_id,
      mso_name,
      mso_lob
    ),

    division:division_id (
      division_id,
      division_name,
      division_code
    ),

    region:region_id (
      region_id,
      region_name,
      region_code
    ),

    state:state_code (
      state_code,
      state_name
    )
  `;

  let query = admin
    .from("pc_org")
    .select(select, { count: "exact" })
    .order("pc_org_name", { ascending: true })
    .range(from, to);

  if (q) {
    // Base search stays on pc_org + fc name (fast + predictable).
    query = query.or(`pc_org_name.ilike.%${q}%,fulfillment_center_name.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows =
    (data ?? []).map((r: any) => ({
      pc_org_id: r.pc_org_id,
      pc_org_name: r.pc_org_name ?? null,

      pc_id: r.pc_id ?? null,
      mso_id: r.mso_id ?? null,
      division_id: r.division_id ?? null,
      region_id: r.region_id ?? null,
      state_code: r.state_code ?? null,

      pc_number: r.pc?.pc_number ?? null,
      mso_name: r.mso?.mso_name ?? null,
      mso_lob: r.mso?.mso_lob ?? null,

      division_name: r.division?.division_name ?? null,
      division_code: r.division?.division_code ?? null,

      region_name: r.region?.region_name ?? null,
      region_code: r.region?.region_code ?? null,

      state_name: r.state?.state_name ?? null,

      fulfillment_center_id: r.fulfillment_center_id == null ? null : String(r.fulfillment_center_id),
      fulfillment_center_name: r.fulfillment_center_name ?? null,
    })) ?? [];

  return NextResponse.json({
    rows,
    page: { pageIndex, pageSize, totalRows: count ?? undefined },
  });
}

export async function POST(req: NextRequest) {
  // signed-in gate (service role remains server-only)
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as Record<string, unknown>;

    // REQUIRED: name
    const pc_org_name = strOrNull(body.pc_org_name);
    if (!pc_org_name) {
      return NextResponse.json({ error: "pc_org_name is required" }, { status: 400 });
    }

    // FC fields are user-entered third-party values — keep BOTH, do not convert to dropdown.
    const insertRow = {
      pc_org_name,

      fulfillment_center_id: strOrNull(body.fulfillment_center_id),
      fulfillment_center_name: strOrNull(body.fulfillment_center_name),

      // foreign refs (selected from dropdowns)
      pc_id: strOrNull(body.pc_id),
      mso_id: strOrNull(body.mso_id),
      division_id: strOrNull(body.division_id),
      region_id: strOrNull(body.region_id),
      state_code: strOrNull(body.state_code),
    };

    const admin = supabaseAdmin();

    // pc_org_id is DB-owned (uuid default)
    const { data: created, error } = await admin
      .from("pc_org")
      .insert(insertRow)
      .select("pc_org_id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { error: workspaceError } = await admin.rpc(
      "ensure_core_workspace_for_pc_org",
      {
        p_pc_org_id: created.pc_org_id,
      }
    );

    if (workspaceError) {
      return NextResponse.json({ error: workspaceError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}