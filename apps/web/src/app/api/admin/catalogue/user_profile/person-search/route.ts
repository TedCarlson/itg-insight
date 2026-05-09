// path: apps/web/src/app/api/admin/catalogue/user_profile/person-search/route.ts

import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  let owner = false;
  let admin = false;

  try {
    const [{ data: isOwner }, { data: isAdmin }] = await Promise.all([
      sb.rpc("is_owner"),
      sb.rpc("is_admin"),
    ]);

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
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(req: NextRequest) {
  const gate = await requireOwnerOrAdmin();

  if (gate.status !== 200) {
    return gate;
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const admin = supabaseAdmin();

  let query = admin
    .from("v_person_core")
    .select("person_id, full_name, emails, active, co_ref_id, co_code, role")
    .order("full_name", { ascending: true })
    .limit(25);

  if (q) {
    const escaped = q.replace(/[%_]/g, "").trim();

    if (isUuid(escaped)) {
      query = query.eq("person_id", escaped);
    } else {
      query = query.or(`full_name.ilike.%${escaped}%,person_id.eq.${escaped}`);
    }
  }

  const res = await query;

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: (res.data ?? []).map((row: any) => ({
      person_id: String(row.person_id),
      full_name: row.full_name ? String(row.full_name) : "—",
      emails: row.emails ? String(row.emails) : null,
      active: row.active === true,
      role: row.role ?? null,
      co_ref_id: row.co_ref_id ?? null,
      co_code: row.co_code ?? null,
    })),
  });
}