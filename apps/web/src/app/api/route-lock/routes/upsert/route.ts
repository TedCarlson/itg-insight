// apps/web/src/app/api/route-lock/routes/upsert/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

function asUuid(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return null;
  return s;
}

function cleanName(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.slice(0, 120);
}

async function guardSelectedOrgRouteLockManage() {
  const sb = await supabaseServer();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) return { ok: false as const, status: 401, error: "unauthorized" };

  const { data: profile, error: profileErr } = await sb
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileErr) return { ok: false as const, status: 500, error: profileErr.message };

  const pc_org_id = (profile?.selected_pc_org_id ?? null) as string | null;
  if (!pc_org_id) return { ok: false as const, status: 409, error: "no selected org" };

  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;

  const { data: isOwner } = await apiClient.rpc("is_owner");
  const { data: isAdmin } = await apiClient.rpc("is_admin");
  const { data: isAppOwner } = await apiClient.rpc("is_app_owner");

  if (isOwner || isAdmin || isAppOwner) {
    return { ok: true as const, pc_org_id };
  }
  const { data: allowed, error: permErr } = await apiClient.rpc("has_pc_org_permission", {
    p_pc_org_id: pc_org_id,
    p_permission_key: "route_lock_manage",
  });

  if (permErr || !allowed) return { ok: false as const, status: 403, error: "forbidden" };

  return { ok: true as const, pc_org_id };
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) return NextResponse.json({ ok: false, error: "missing NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
  if (!service) return NextResponse.json({ ok: false, error: "missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

  const guard = await guardSelectedOrgRouteLockManage();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => ({}));
  const route_id = asUuid(body?.route_id);
  const route_name = cleanName(body?.route_name);

  if (!route_name) return NextResponse.json({ ok: false, error: "route_name is required" }, { status: 400 });

  const admin = supabaseAdmin();

  // If editing: make sure it belongs to this org
  if (route_id) {
    const { data: existing, error: exErr } = await admin
      .from("route")
      .select("route_id, pc_org_id")
      .eq("route_id", route_id)
      .maybeSingle();

    if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ ok: false, error: "route not found" }, { status: 404 });
    if (String((existing as any).pc_org_id) !== String(guard.pc_org_id)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { error: updErr } = await admin
      .from("route")
      .update({ route_name })
      .eq("route_id", route_id)
      .eq("pc_org_id", guard.pc_org_id);

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  } else {
    const { error: insErr } = await admin.from("route").insert({ route_name, pc_org_id: guard.pc_org_id });
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  // Return row from admin view (so the right pane always reflects joins)
  const q = admin
    .from("route_admin_v")
    .select(
      "route_id, route_name, pc_org_id, pc_org_name, pc_number, mso_name, division_name, division_code, region_name, region_code"
    )
    .eq("pc_org_id", guard.pc_org_id);

  const { data: item, error: readErr } = route_id
    ? await q.eq("route_id", route_id).maybeSingle()
    : await q.eq("route_name", route_name).order("route_id", { ascending: false }).limit(1).maybeSingle();

  if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
  if (!item) return NextResponse.json({ ok: false, error: "saved but not found in route_admin_v" }, { status: 500 });

  return NextResponse.json({ ok: true, item });
}