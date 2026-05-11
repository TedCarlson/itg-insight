// path: apps/web/src/app/api/admin/catalogue/user_profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { buildUserProfileRows } from "@/features/admin/catalogue/user-profile/buildUserProfileRows";
import { requireOwnerOrAdmin } from "@/features/admin/catalogue/user-profile/userProfileApiGuard";
import { clean, num } from "@/features/admin/catalogue/user-profile/userProfileApiTypes";

export const runtime = "nodejs";

function filterRows(
  rows: Awaited<ReturnType<typeof buildUserProfileRows>>["rows"],
  q: string
) {
  if (!q) return rows;

  return rows.filter((row) => {
    const haystack = [
      row.auth_user_id,
      row.email,
      row.person_id,
      row.person_full_name,
      row.core_person_id,
      row.core_person_full_name,
      row.legacy_person_id,
      row.status,
      row.selected_pc_org_id,
      row.selected_pc_org_name,
      row.is_admin ? "admin" : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
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

  const built = await buildUserProfileRows();

  if (built.error) {
    return NextResponse.json({ error: built.error }, { status: 500 });
  }

  const filtered = filterRows(built.rows, q);
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

  const authUserId = String(body.auth_user_id ?? "").trim();

  if (!authUserId) {
    return NextResponse.json(
      { error: "missing_auth_user_id" },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {
    auth_user_id: authUserId,
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
      return NextResponse.json(
        { error: personRes.error.message },
        { status: 500 }
      );
    }

    if (!personRes.data?.person_id) {
      return NextResponse.json(
        { error: "invalid_core_person_id" },
        { status: 400 }
      );
    }
  }

  if (typeof patch.selected_pc_org_id === "string") {
    const pcOrgRes = await admin
      .from("pc_org")
      .select("pc_org_id")
      .eq("pc_org_id", patch.selected_pc_org_id)
      .maybeSingle();

    if (pcOrgRes.error) {
      return NextResponse.json(
        { error: pcOrgRes.error.message },
        { status: 500 }
      );
    }

    if (!pcOrgRes.data?.pc_org_id) {
      return NextResponse.json(
        { error: "invalid_selected_pc_org_id" },
        { status: 400 }
      );
    }
  }

  const upsertResult = await admin
    .from("user_profile")
    .upsert(patch, { onConflict: "auth_user_id" });

  if (upsertResult.error) {
    return NextResponse.json(
      { error: upsertResult.error.message },
      { status: 400 }
    );
  }

  const built = await buildUserProfileRows();

  if (built.error) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const row =
    built.rows.find((candidate) => candidate.auth_user_id === authUserId) ??
    null;

  return NextResponse.json({ ok: true, row }, { status: 200 });
}