import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireAdmin } from "@/app/api/admin/catalogue/_lib/guards";

type Row = {
  auth_user_id: string;
  email: string | null;
  last_sign_in_at: string | null;

  profile_status: string | null;
  selected_pc_org_id: string | null;
  is_admin: boolean;

  person_id: string | null;
  person_full_name: string | null;
  person_emails: string | null;
  person_active: boolean | null;

  // per-selected-org convenience (based on selected_pc_org_id)
  has_dispatch_manage_grant: boolean;
};

function toBool(v: any) {
  return v === true;
}

export async function GET(req: NextRequest) {
  await requireAdmin();

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200;

  const admin = supabaseAdmin();

  // 1) Pull auth users (service role)
  const usersRes = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = usersRes?.data?.users ?? [];

  // Lightweight filter by email/id (client-side)
  const filteredUsers = users.filter((u) => {
    if (!q) return true;
    const email = (u.email ?? "").toLowerCase();
    const id = (u.id ?? "").toLowerCase();
    return email.includes(q) || id.includes(q);
  });

  const slice = filteredUsers.slice(0, limit);
  const authIds = slice.map((u) => u.id);

  if (authIds.length === 0) {
    return NextResponse.json({ ok: true, rows: [] satisfies Row[] }, { status: 200 });
  }

  // 2) Load user_profile for these auth users
  const profRes = await admin
    .from("user_profile")
    .select("auth_user_id,person_id,status,is_admin,selected_pc_org_id")
    .in("auth_user_id", authIds);

  if (profRes.error) {
    return NextResponse.json({ ok: false, error: "profile_fetch_failed", details: profRes.error }, { status: 500 });
  }

  const profByAuth = new Map<string, any>();
  for (const p of profRes.data ?? []) profByAuth.set(p.auth_user_id, p);

  // 3) Load persons for linked person_ids
  const personIds = Array.from(
    new Set(
      (profRes.data ?? [])
        .map((p) => p.person_id)
        .filter((x: any) => typeof x === "string" && x.length > 0),
    ),
  ) as string[];

  const personById = new Map<string, any>();
  if (personIds.length) {
    const peopleRes = await admin
      .from("person")
      .select("person_id,full_name,emails,active")
      .in("person_id", personIds);

    if (peopleRes.error) {
      return NextResponse.json({ ok: false, error: "person_fetch_failed", details: peopleRes.error }, { status: 500 });
    }
    for (const r of peopleRes.data ?? []) personById.set(r.person_id, r);
  }

  // 4) dispatch_manage grants for each user's selected_pc_org_id
  // We only answer “has grant?” for the user’s *selected* org to keep it simple and useful.
  const selectedPairs = (profRes.data ?? [])
    .map((p) => ({ auth_user_id: p.auth_user_id as string, pc_org_id: p.selected_pc_org_id as string | null }))
    .filter((x) => !!x.pc_org_id);

  // Fetch all matching dispatch_manage rows for these (auth_user_id, pc_org_id) pairs
  // We do it in 2 steps: by auth ids, then check match on (auth_user_id, pc_org_id) client-side.
  const grantsRes = await admin
    .from("pc_org_permission_grant")
    .select("auth_user_id,pc_org_id,permission_key,expires_at,revoked_at")
    .in("auth_user_id", authIds)
    .eq("permission_key", "dispatch_manage")
    .is("revoked_at", null);

  if (grantsRes.error) {
    return NextResponse.json({ ok: false, error: "grant_fetch_failed", details: grantsRes.error }, { status: 500 });
  }

  const now = new Date();
  const grantKey = new Set<string>();
  for (const g of grantsRes.data ?? []) {
    const exp = g.expires_at ? new Date(g.expires_at) : null;
    if (exp && exp <= now) continue;
    grantKey.add(`${g.auth_user_id}::${g.pc_org_id}`);
  }

  const rows: Row[] = slice.map((u) => {
    const prof = profByAuth.get(u.id) ?? null;
    const person = prof?.person_id ? personById.get(prof.person_id) ?? null : null;

    const pcOrg = (prof?.selected_pc_org_id ?? null) as string | null;
    const hasDispatch = pcOrg ? grantKey.has(`${u.id}::${pcOrg}`) : false;

    return {
      auth_user_id: u.id,
      email: u.email ?? null,
      last_sign_in_at: (u.last_sign_in_at as any) ?? null,

      profile_status: (prof?.status ?? null) as string | null,
      selected_pc_org_id: pcOrg,
      is_admin: toBool(prof?.is_admin),

      person_id: (prof?.person_id ?? null) as string | null,
      person_full_name: (person?.full_name ?? null) as string | null,
      person_emails: (person?.emails ?? null) as string | null,
      person_active: (person?.active ?? null) as boolean | null,

      has_dispatch_manage_grant: hasDispatch,
    };
  });

  return NextResponse.json({ ok: true, rows }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const { user, admin } = await requireAdmin();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const auth_user_id = String((body as any).auth_user_id ?? "");
  const person_id_raw = (body as any).person_id;
  const selected_pc_org_id_raw = (body as any).selected_pc_org_id;
  const is_admin_raw = (body as any).is_admin;
  const dispatch_manage_enabled_raw = (body as any).dispatch_manage_enabled;

  const pc_org_id_raw = (body as any).pc_org_id; // optional explicit target org for dispatch grant

  if (!auth_user_id) {
    return NextResponse.json({ ok: false, error: "missing_auth_user_id" }, { status: 400 });
  }

  // Normalize nullable fields
  const person_id = person_id_raw === null || person_id_raw === undefined || person_id_raw === "" ? null : String(person_id_raw);
  const selected_pc_org_id =
    selected_pc_org_id_raw === null || selected_pc_org_id_raw === undefined || selected_pc_org_id_raw === ""
      ? null
      : String(selected_pc_org_id_raw);

  const patch: any = { auth_user_id };
  if ((body as any).person_id !== undefined) patch.person_id = person_id;
  if ((body as any).selected_pc_org_id !== undefined) patch.selected_pc_org_id = selected_pc_org_id;
  if ((body as any).is_admin !== undefined) patch.is_admin = !!is_admin_raw;

  // Upsert profile changes if any
  if (Object.keys(patch).length > 1) {
    const up = await admin.from("user_profile").upsert(patch, { onConflict: "auth_user_id" }).select("*").maybeSingle();
    if (up.error) {
      return NextResponse.json({ ok: false, error: "profile_upsert_failed", details: up.error }, { status: 400 });
    }
  }

  // dispatch_manage toggle (optional)
  if (dispatch_manage_enabled_raw !== undefined) {
    const targetPcOrg = pc_org_id_raw ? String(pc_org_id_raw) : selected_pc_org_id;
    if (!targetPcOrg) {
      return NextResponse.json(
        { ok: false, error: "missing_pc_org_id_for_dispatch_manage", details: "Provide pc_org_id or set selected_pc_org_id first." },
        { status: 400 },
      );
    }

    const enable = !!dispatch_manage_enabled_raw;

    if (enable) {
      const ins = await admin
        .from("pc_org_permission_grant")
        .upsert(
          {
            pc_org_id: targetPcOrg,
            auth_user_id,
            permission_key: "dispatch_manage",
            created_by: user.id,
            revoked_at: null,
            revoked_by: null,
          },
          { onConflict: "pc_org_id,auth_user_id,permission_key" },
        )
        .select("*")
        .maybeSingle();

      if (ins.error) {
        return NextResponse.json({ ok: false, error: "dispatch_grant_upsert_failed", details: ins.error }, { status: 400 });
      }
    } else {
      const rev = await admin
        .from("pc_org_permission_grant")
        .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
        .eq("pc_org_id", targetPcOrg)
        .eq("auth_user_id", auth_user_id)
        .eq("permission_key", "dispatch_manage")
        .is("revoked_at", null);

      if (rev.error) {
        return NextResponse.json({ ok: false, error: "dispatch_grant_revoke_failed", details: rev.error }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}