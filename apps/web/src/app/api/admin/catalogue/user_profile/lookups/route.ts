import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

async function requireOwnerOrAdmin() {
  const sb = await supabaseServer();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) {
    return { ok: false as const, status: 401 as const, error: "unauthorized" as const };
  }

  let owner = false;
  let admin = false;

  try {
    const [{ data: isOwner }, { data: isAdmin }] = await Promise.all([sb.rpc("is_owner"), sb.rpc("is_admin")]);
    owner = isOwner === true;
    admin = isAdmin === true;
  } catch {
    // ignore
  }

  if (!owner && !admin) {
    try {
      const svc = supabaseAdmin();
      const grant = await svc
        .from("admin_permission_grant")
        .select("auth_user_id")
        .eq("auth_user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (grant.data?.auth_user_id) admin = true;
    } catch {
      // ignore
    }
  }

  if (!owner && !admin) {
    return { ok: false as const, status: 403 as const, error: "forbidden" as const };
  }

  return { ok: true as const, status: 200 as const, error: null };
}

export async function GET() {
  const gate = await requireOwnerOrAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const admin = supabaseAdmin();

  const orgsRes = await admin
    .from("pc_org")
    .select("pc_org_id, pc_org_name")
    .order("pc_org_name", { ascending: true })
    .limit(1000);

  if (orgsRes.error) {
    return NextResponse.json({ error: orgsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    orgs: (orgsRes.data ?? []).map((r: any) => ({
      pc_org_id: String(r.pc_org_id),
      pc_org_name: r.pc_org_name ? String(r.pc_org_name) : null,
    })),
  });
}