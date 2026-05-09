// path: apps/web/src/app/api/admin/catalogue/user_profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type UserProfileRow = {
  auth_user_id: string;
  email: string | null;

  // UI-compatible alias now points to core.people
  person_id: string | null;
  person_full_name: string | null;

  core_person_id: string | null;
  core_person_full_name: string | null;

  // legacy compatibility only
  legacy_person_id: string | null;

  status: string | null;
  selected_pc_org_id: string | null;
  selected_pc_org_name: string | null;
  is_admin: boolean;
  created_at: string | null;
  updated_at: string | null;
};

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clean(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next || null;
}

async function requireOwnerOrAdmin() {
  const sb = await supabaseServer();

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) {
    return {
      ok: false as const,
      status: 401 as const,
      error: "unauthorized" as const,
      user: null,
    };
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
    // keep fallbacks below
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
      // ignore and fall through
    }
  }

  if (!owner && !admin) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "forbidden" as const,
      user: null,
    };
  }

  return { ok: true as const, status: 200 as const, error: null, user };
}

async function buildRows(): Promise<{ rows: UserProfileRow[]; error?: string }> {
  const admin = supabaseAdmin();

  const profRes = await admin
    .from("user_profile")
    .select(
      "auth_user_id, person_id, core_person_id, status, selected_pc_org_id, is_admin, created_at, updated_at"
    )
    .limit(5000);

  if (profRes.error) {
    return { rows: [], error: profRes.error.message };
  }

  const profiles = (profRes.data ?? []) as Array<{
    auth_user_id: string;
    person_id: string | null;
    core_person_id: string | null;
    status: string | null;
    selected_pc_org_id: string | null;
    is_admin: boolean | null;
    created_at: string | null;
    updated_at: string | null;
  }>;

  const corePersonIds = Array.from(
    new Set(
      profiles
        .map((p) => p.core_person_id ?? p.person_id)
        .map(clean)
        .filter(Boolean)
    )
  ) as string[];

  const pcOrgIds = Array.from(
    new Set(profiles.map((p) => p.selected_pc_org_id).map(clean).filter(Boolean))
  ) as string[];

  const [usersRes, corePeopleRes, orgRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    corePersonIds.length
      ? admin
        .from("v_person_core")
        .select("person_id, full_name")
        .in("person_id", corePersonIds)
      : Promise.resolve({ data: [], error: null } as any),
    pcOrgIds.length
      ? admin
        .from("pc_org")
        .select("pc_org_id, pc_org_name")
        .in("pc_org_id", pcOrgIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (corePeopleRes?.error) {
    return { rows: [], error: corePeopleRes.error.message };
  }

  if (orgRes?.error) {
    return { rows: [], error: orgRes.error.message };
  }

  const emailByAuth = new Map<string, string | null>();

  for (const u of usersRes?.data?.users ?? []) {
    emailByAuth.set(String(u.id), (u.email ?? null) as string | null);
  }

  const nameByCorePerson = new Map<string, string | null>();

  for (const p of corePeopleRes?.data ?? []) {
    nameByCorePerson.set(
      String((p as any).person_id),
      ((p as any).full_name ?? null) as string | null
    );
  }

  const orgById = new Map<string, string | null>();

  for (const o of orgRes?.data ?? []) {
    orgById.set(
      String((o as any).pc_org_id),
      ((o as any).pc_org_name ?? null) as string | null
    );
  }

  const rows: UserProfileRow[] = profiles.map((p) => {
    const effectiveCorePersonId = clean(p.core_person_id ?? p.person_id);

    return {
      auth_user_id: String(p.auth_user_id),
      email: emailByAuth.get(String(p.auth_user_id)) ?? null,

      person_id: effectiveCorePersonId,
      person_full_name: effectiveCorePersonId
        ? nameByCorePerson.get(effectiveCorePersonId) ?? null
        : null,

      core_person_id: effectiveCorePersonId,
      core_person_full_name: effectiveCorePersonId
        ? nameByCorePerson.get(effectiveCorePersonId) ?? null
        : null,

      legacy_person_id: clean(p.person_id),

      status: p.status ?? null,
      selected_pc_org_id: clean(p.selected_pc_org_id),
      selected_pc_org_name: p.selected_pc_org_id
        ? orgById.get(String(p.selected_pc_org_id)) ?? null
        : null,
      is_admin: p.is_admin === true,
      created_at: p.created_at ?? null,
      updated_at: p.updated_at ?? null,
    };
  });

  rows.sort((a, b) => {
    const aTs = a.updated_at ?? a.created_at ?? "";
    const bTs = b.updated_at ?? b.created_at ?? "";
    return bTs.localeCompare(aTs);
  });

  return { rows };
}

export async function GET(req: NextRequest) {
  const gate = await requireOwnerOrAdmin();

  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const pageIndex = Math.max(0, num(url.searchParams.get("pageIndex"), 0));
  const pageSizeRaw = num(url.searchParams.get("pageSize"), 25);
  const pageSize = Math.min(100, Math.max(5, pageSizeRaw));

  const built = await buildRows();

  if (built.error) {
    return NextResponse.json({ error: built.error }, { status: 500 });
  }

  const filtered = q
    ? built.rows.filter((r) => {
      const hay = [
        r.auth_user_id,
        r.email,
        r.person_id,
        r.person_full_name,
        r.core_person_id,
        r.core_person_full_name,
        r.legacy_person_id,
        r.status,
        r.selected_pc_org_id,
        r.selected_pc_org_name,
        r.is_admin ? "admin" : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    })
    : built.rows;

  const from = pageIndex * pageSize;
  const rows = filtered.slice(from, from + pageSize);

  return NextResponse.json({
    rows,
    page: { pageIndex, pageSize, totalRows: filtered.length },
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireOwnerOrAdmin();

  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const auth_user_id = String(body.auth_user_id ?? "").trim();

  if (!auth_user_id) {
    return NextResponse.json(
      { error: "missing_auth_user_id" },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {
    auth_user_id,
    updated_at: new Date().toISOString(),
  };

  if (
    Object.prototype.hasOwnProperty.call(body, "core_person_id") ||
    Object.prototype.hasOwnProperty.call(body, "person_id")
  ) {
    const raw = Object.prototype.hasOwnProperty.call(body, "core_person_id")
      ? body.core_person_id
      : body.person_id;

    patch.core_person_id =
      raw === null || raw === undefined || String(raw).trim() === ""
        ? null
        : String(raw).trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "selected_pc_org_id")) {
    const raw = body.selected_pc_org_id;

    patch.selected_pc_org_id =
      raw === null || raw === undefined || String(raw).trim() === ""
        ? null
        : String(raw).trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const status = String(body.status ?? "").trim();

    if (!status) {
      return NextResponse.json({ error: "missing_status" }, { status: 400 });
    }

    patch.status = status;
  }

  if (Object.prototype.hasOwnProperty.call(body, "is_admin")) {
    patch.is_admin = body.is_admin === true;
  }

  if (Object.keys(patch).length <= 2) {
    return NextResponse.json(
      { error: "no_editable_fields_provided" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  if (typeof patch.core_person_id === "string") {
    const personRes = await admin
      .from("v_person_core")
      .select("person_id")
      .eq("person_id", patch.core_person_id)
      .maybeSingle();

    if (personRes.error) {
      return NextResponse.json({ error: personRes.error.message }, { status: 500 });
    }

    if (!personRes.data?.person_id) {
      return NextResponse.json({ error: "invalid_core_person_id" }, { status: 400 });
    }
  }

  if (typeof patch.selected_pc_org_id === "string") {
    const pcOrgRes = await admin
      .from("pc_org")
      .select("pc_org_id")
      .eq("pc_org_id", patch.selected_pc_org_id)
      .maybeSingle();

    if (pcOrgRes.error) {
      return NextResponse.json({ error: pcOrgRes.error.message }, { status: 500 });
    }

    if (!pcOrgRes.data?.pc_org_id) {
      return NextResponse.json(
        { error: "invalid_selected_pc_org_id" },
        { status: 400 }
      );
    }
  }

  const up = await admin
    .from("user_profile")
    .upsert(patch, { onConflict: "auth_user_id" });

  if (up.error) {
    return NextResponse.json({ error: up.error.message }, { status: 400 });
  }

  const built = await buildRows();

  if (built.error) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const row = built.rows.find((r) => r.auth_user_id === auth_user_id) ?? null;

  return NextResponse.json({ ok: true, row }, { status: 200 });
}