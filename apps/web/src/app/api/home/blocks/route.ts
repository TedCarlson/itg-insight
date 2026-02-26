// apps/web/src/app/api/home/blocks/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type Lob = "FULFILLMENT" | "LOCATE";

function normalizeLob(v: unknown): Lob | null {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "FULFILLMENT") return "FULFILLMENT";
  if (s === "LOCATE") return "LOCATE";
  return null;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function apiSchema(client: any) {
  return (client as any).schema ? (client as any).schema("api") : client;
}

async function canAccessPcOrg(supabaseUser: any, pc_org_id: string): Promise<{ ok: boolean; error?: string }> {
  const api = apiSchema(supabaseUser);
  const { data, error } = await api.rpc("can_access_pc_org", { p_pc_org_id: pc_org_id });
  if (error) return { ok: false, error: error.message ?? "can_access_pc_org failed" };
  return { ok: Boolean(data) };
}

async function canManageConsole(supabaseUser: any, pc_org_id: string): Promise<{ ok: boolean; error?: string }> {
  const api = apiSchema(supabaseUser);
  const { data, error } = await api.rpc("can_manage_pc_org_console", { p_pc_org_id: pc_org_id });
  if (error) return { ok: false, error: error.message ?? "can_manage_pc_org_console failed" };
  return { ok: Boolean(data) };
}

async function getIsOwner(supabaseUser: any): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabaseUser.rpc("is_owner");
  if (error) return { ok: false, error: error.message ?? "is_owner failed" };
  return { ok: Boolean(data) };
}

export async function GET(req: Request) {
  const sb = await supabaseServer();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const pc_org_id = String(url.searchParams.get("pc_org_id") ?? "").trim();
  const lob = normalizeLob(url.searchParams.get("lob"));

  if (!pc_org_id || !isUuid(pc_org_id)) {
    return NextResponse.json({ ok: false, error: "invalid pc_org_id" }, { status: 400 });
  }
  if (!lob) {
    return NextResponse.json({ ok: false, error: "invalid lob" }, { status: 400 });
  }

  // Baseline org gate (same as other endpoints)
  const access = await canAccessPcOrg(sb, pc_org_id);
  if (access.error) {
    return NextResponse.json({ ok: false, error: "gate_error", details: access.error }, { status: 500 });
  }
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let svc: any;
  try {
    svc = supabaseAdmin();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "service_client_unavailable", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }

  const { data, error } = await svc
    .from("pc_org_home_block")
    .select(
      "pc_org_home_block_id, pc_org_id, lob, area, sort, block_type, title, config, is_enabled, created_at, updated_at"
    )
    .eq("pc_org_id", pc_org_id)
    .eq("lob", lob)
    .eq("is_enabled", true)
    .order("area", { ascending: true })
    .order("sort", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [] });
}

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  const pc_org_id = String(body?.pc_org_id ?? "").trim();
  const lob = normalizeLob(body?.lob);
  const rows = Array.isArray(body?.rows) ? body.rows : null;

  if (!pc_org_id || !isUuid(pc_org_id)) {
    return NextResponse.json({ ok: false, error: "invalid pc_org_id" }, { status: 400 });
  }
  if (!lob) {
    return NextResponse.json({ ok: false, error: "invalid lob" }, { status: 400 });
  }
  if (!rows) {
    return NextResponse.json({ ok: false, error: "invalid rows" }, { status: 400 });
  }

  // Baseline org gate
  const access = await canAccessPcOrg(sb, pc_org_id);
  if (access.error) {
    return NextResponse.json({ ok: false, error: "gate_error", details: access.error }, { status: 500 });
  }
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // Write gate: owner OR can_manage_pc_org_console
  const owner = await getIsOwner(sb);
  if (owner.error) {
    return NextResponse.json({ ok: false, error: "gate_error", details: owner.error }, { status: 500 });
  }
  if (!owner.ok) {
    const manage = await canManageConsole(sb, pc_org_id);
    if (manage.error) {
      return NextResponse.json({ ok: false, error: "gate_error", details: manage.error }, { status: 500 });
    }
    if (!manage.ok) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  let svc: any;
  try {
    svc = supabaseAdmin();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "service_client_unavailable", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }

  // Replace layout for (pc_org_id, lob)
  const del = await svc.from("pc_org_home_block").delete().eq("pc_org_id", pc_org_id).eq("lob", lob);
  if (del.error) {
    return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });
  }

  const payload = rows.map((r: any) => ({
    pc_org_id,
    lob,
    area: String(r?.area ?? "left"),
    sort: Number.isFinite(Number(r?.sort)) ? Number(r.sort) : 0,
    block_type: String(r?.block_type ?? "narrative"),
    title: r?.title === null || r?.title === undefined ? null : String(r.title),
    config: r?.config ?? {},
    is_enabled: r?.is_enabled === false ? false : true,
    updated_at: new Date().toISOString(),
  }));

  if (payload.length === 0) {
    return NextResponse.json({ ok: true, rows: [] });
  }

  const ins = await svc
    .from("pc_org_home_block")
    .insert(payload)
    .select("pc_org_home_block_id, pc_org_id, lob, area, sort, block_type, title, config, is_enabled");

  if (ins.error) {
    return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: ins.data ?? [] });
}