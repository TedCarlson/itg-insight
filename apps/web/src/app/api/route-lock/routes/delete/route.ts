// apps/web/src/app/api/route-lock/routes/delete/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function asUuid(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return null;
  return s;
}

async function requireAuthedSelectedOrg() {
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

  // Permission gate (owners pass via break-glass in has_pc_org_permission)
  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;
  const { data: allowed, error: permErr } = await apiClient.rpc("has_pc_org_permission", {
    p_pc_org_id: pc_org_id,
    p_permission_key: "route_lock_manage",
  });

  if (permErr || !allowed) return { ok: false as const, status: 403, error: "forbidden" };

  return { ok: true as const, pc_org_id };
}

export async function POST(req: Request) {
  const guard = await requireAuthedSelectedOrg();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => ({}));
  const route_id = asUuid(body?.route_id);
  if (!route_id) return NextResponse.json({ ok: false, error: "invalid route_id" }, { status: 400 });

  const admin = supabaseAdmin();

  // Ensure route belongs to selected org
  const { data: existing, error: exErr } = await admin
    .from("route")
    .select("route_id, pc_org_id")
    .eq("route_id", route_id)
    .maybeSingle();

  if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ ok: false, error: "route not found" }, { status: 404 });
  if (String(existing.pc_org_id) !== String(guard.pc_org_id)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // NOTE: If quota/schedule has FK constraints to route, delete may fail.
  // We keep the error message intact so you can see constraint names.
  const { error } = await admin.from("route").delete().eq("route_id", route_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}