// path: apps/web/src/app/api/people/create/route.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

type RequestBody = {
  full_name: string;
  tech_id?: string | null;
  email?: string | null;
  mobile?: string | null;
  nt_login?: string | null;
  csg?: string | null;
  prospecting_affiliation_id?: string | null;
  onboarding_pc_org_id?: string | null;
};

function clean(value: string | null | undefined) {
  const next = String(value ?? "").trim();
  return next || null;
}

export async function POST(req: Request) {
  const userClient = await supabaseServer();
  const adminClient = await supabaseAdmin();

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fullName = clean(body.full_name);

  if (!fullName) {
    return NextResponse.json({ error: "Missing full_name" }, { status: 400 });
  }

  const { data, error } = await adminClient.rpc("people_create_for_current_user", {
    p_auth_user_id: user.id,
    p_full_name: fullName,
    p_tech_id: clean(body.tech_id),
    p_nt_login: clean(body.nt_login),
    p_csg: clean(body.csg),
    p_mobile: clean(body.mobile),
    p_email: clean(body.email),
    p_prospecting_affiliation_id: clean(body.prospecting_affiliation_id),
    p_onboarding_pc_org_id: clean(body.onboarding_pc_org_id),
  });

  const result = data as {
    ok?: boolean;
    error?: string;
    person_id?: string;
    onboarding_pc_org_id?: string | null;
    onboarding_pc_org_name?: string | null;
  } | null;

  if (error || !result?.ok || !result.person_id) {
    return NextResponse.json(
      { error: error?.message ?? result?.error ?? "Unable to create person" },
      { status: error ? 500 : 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    person_id: result.person_id,
    onboarding_pc_org_id: result.onboarding_pc_org_id ?? null,
    onboarding_pc_org_name: result.onboarding_pc_org_name ?? null,
  });
}
