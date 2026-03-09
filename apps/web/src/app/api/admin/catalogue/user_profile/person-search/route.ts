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
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest) {
  const gate = await requireOwnerOrAdmin();
  if (gate.status !== 200) {
    return gate;
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const admin = supabaseAdmin();

  let query = admin
    .from("person")
    .select("person_id, full_name, emails, active")
    .order("full_name", { ascending: true })
    .limit(25);

  if (q) {
    const escaped = q.replace(/[%_]/g, "").trim();

    if (isUuid(escaped)) {
      query = query.eq("person_id", escaped);
    } else {
      query = query.or(`full_name.ilike.%${escaped}%,emails.ilike.%${escaped}%,person_id.eq.${escaped}`);
    }
  }

  const res = await query;
  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: (res.data ?? []).map((r: any) => ({
      person_id: String(r.person_id),
      full_name: r.full_name ? String(r.full_name) : "—",
      emails: r.emails ? String(r.emails) : null,
      active: r.active === true,
    })),
  });
}