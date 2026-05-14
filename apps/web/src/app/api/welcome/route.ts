// apps/web/src/app/api/welcome/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type PcOrgChoice = {
  pc_org_id: string;
  pc_org_name: string | null;
  mso_lob?: string | null;
};

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function orgLabel(row: any): string | null {
  return (
    clean(row?.pc_org_name) ??
    clean(row?.org_name) ??
    clean(row?.name) ??
    clean(row?.label) ??
    null
  );
}

async function loadOrgChoices(sb: any): Promise<PcOrgChoice[]> {
  const apiClient = sb.schema ? sb.schema("api") : sb;
  const { data, error } = await apiClient.rpc("pc_org_choices");

  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : [])
    .map((row: any) => {
      const pcOrgId = clean(row?.pc_org_id);
      if (!pcOrgId) return null;

      return {
        pc_org_id: pcOrgId,
        pc_org_name: orgLabel(row),
        mso_lob: clean(row?.mso_lob),
      };
    })
    .filter(Boolean) as PcOrgChoice[];
}

async function loadProfile(admin: any, authUserId: string) {
  const { data, error } = await admin
    .from("user_profile" as any)
    .select(
      "auth_user_id, person_id, core_person_id, selected_pc_org_id, status, is_admin"
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data as {
    auth_user_id: string;
    person_id: string | null;
    core_person_id: string | null;
    selected_pc_org_id: string | null;
    status: string | null;
    is_admin: boolean | null;
  } | null;
}

function resolvePersonId(profile: Awaited<ReturnType<typeof loadProfile>>) {
  return clean(profile?.core_person_id) ?? clean(profile?.person_id);
}

async function loadAssignmentId(admin: any, personId: string, pcOrgId: string) {
  const { data, error } = await admin
    .from("workforce_current_v" as any)
    .select("assignment_id")
    .eq("person_id", personId)
    .eq("pc_org_id", pcOrgId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return clean(data?.assignment_id);
}

export async function GET() {
  try {
    const sb = await supabaseServer();

    const {
      data: { user },
      error: userErr,
    } = await sb.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const profile = await loadProfile(admin, user.id);
    const orgs = await loadOrgChoices(sb);

    const selectedPcOrgId = clean(profile?.selected_pc_org_id);
    const personId = resolvePersonId(profile);

    const { data: sessionFacts, error: factError } = await admin
      .from("app_access_session_fact" as any)
      .select("first_seen_in_app_at, last_seen_in_app_at")
      .eq("auth_user_id", user.id)
      .order("last_seen_in_app_at", { ascending: false })
      .limit(1);

    if (factError) throw new Error(factError.message);

    const hasVerifiedAccess =
      Array.isArray(sessionFacts) && sessionFacts.length > 0;

    return NextResponse.json({
      ok: true,
      auth_user_id: user.id,
      email: user.email ?? null,
      profile: {
        status: profile?.status ?? null,
        person_id: personId,
        selected_pc_org_id: selectedPcOrgId,
        is_admin: profile?.is_admin === true,
      },
      orgs,
      org_count: orgs.length,
      has_verified_access: hasVerifiedAccess,
      recommended_pc_org_id:
        selectedPcOrgId && orgs.some((o) => o.pc_org_id === selectedPcOrgId)
          ? selectedPcOrgId
          : orgs.length === 1
            ? orgs[0]?.pc_org_id ?? null
            : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: "welcome_bootstrap_failed", details: error?.message ?? null },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await supabaseServer();

    const {
      data: { user },
      error: userErr,
    } = await sb.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedPcOrgId = clean(body?.selected_pc_org_id);

    const admin = supabaseAdmin();
    const profile = await loadProfile(admin, user.id);
    const personId = resolvePersonId(profile);

    if (!personId) {
      return NextResponse.json(
        { ok: false, error: "person_link_missing" },
        { status: 409 }
      );
    }

    const orgs = await loadOrgChoices(sb);

    const selectedPcOrgId =
      requestedPcOrgId ??
      (orgs.length === 1 ? orgs[0]?.pc_org_id ?? null : null);

    if (!selectedPcOrgId || !isUuid(selectedPcOrgId)) {
      return NextResponse.json(
        { ok: false, error: "selected_pc_org_id_required" },
        { status: 400 }
      );
    }

    const allowed = orgs.some((org) => org.pc_org_id === selectedPcOrgId);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "forbidden_org" }, { status: 403 });
    }

    const assignmentId = await loadAssignmentId(admin, personId, selectedPcOrgId);

    const { error: profileUpdateError } = await admin
      .from("user_profile" as any)
      .update({
        selected_pc_org_id: selectedPcOrgId,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", user.id);

    if (profileUpdateError) throw new Error(profileUpdateError.message);

    const { error: rpcError } = await admin.rpc("record_app_session_evidence", {
      p_auth_user_id: user.id,
      p_person_id: personId,
      p_pc_org_id: selectedPcOrgId,
      p_assignment_id: assignmentId,
      p_email: user.email ?? null,
    });

    if (rpcError) throw new Error(rpcError.message);

    return NextResponse.json({
      ok: true,
      selected_pc_org_id: selectedPcOrgId,
      person_id: personId,
      assignment_id: assignmentId,
      next: "/home",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: "welcome_complete_failed", details: error?.message ?? null },
      { status: 500 }
    );
  }
}