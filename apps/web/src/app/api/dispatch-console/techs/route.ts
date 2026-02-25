// apps/web/src/app/api/dispatch-console/techs/route.ts

import { NextResponse } from "next/server";
import { requireSelectedPcOrgServer } from "@/shared/lib/auth/requireSelectedPcOrg.server";
import { requireDispatchConsoleAccess } from "../_auth";

function pickPcOrgId(sel: any, fallback: string | null): string | null {
  const raw =
    sel?.pc_org_id ??
    sel?.pcOrgId ??
    sel?.pc_orgId ??
    sel?.selected_org_id ??
    sel?.selectedOrgId ??
    sel?.org_id ??
    sel?.orgId ??
    fallback ??
    null;

  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s.length ? s : null;
}

export async function GET(req: Request) {
  try {
    const authz = await requireDispatchConsoleAccess();
    if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });

    const url = new URL(req.url);
    const qPcOrgId = url.searchParams.get("pc_org_id");

    const sel = await requireSelectedPcOrgServer();
    const selectedPcOrgId = sel.ok ? sel.selected_pc_org_id : null;
    const pc_org_id = pickPcOrgId({ pc_org_id: qPcOrgId }, selectedPcOrgId);

    if (!pc_org_id) {
      return NextResponse.json({ ok: false, error: "Missing pc_org_id (select a PC scope)" }, { status: 400 });
    }
    if (selectedPcOrgId && pc_org_id !== selectedPcOrgId) {
      return NextResponse.json({ ok: false, error: "Forbidden (org mismatch)" }, { status: 403 });
    }

    // RLS applies via the user's server client.
    const { data, error } = await authz.supabase
      .from("route_lock_roster_tech_v")
      .select("*")
      .eq("pc_org_id", pc_org_id)
      .order("full_name", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const techs = (data ?? []).map((r: any) => ({
      assignment_id: String(r.assignment_id ?? ""),
      person_id: r.person_id ?? null,
      tech_id: r.tech_id ?? null,
      full_name: r.full_name ?? null,
      co_name: r.co_name ?? null,
    }));

    return NextResponse.json({ ok: true, techs }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}