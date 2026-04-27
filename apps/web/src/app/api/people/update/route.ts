// path: apps/web/src/app/api/people/update/route.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

type PersonStatus = "active" | "inactive" | "onboarding" | "onboarding_closed";

type RequestBody = {
  person_id: string;
  full_name: string;
  legal_name?: string | null;
  preferred_name?: string | null;
  status?: PersonStatus;
  tech_id?: string | null;
  fuse_emp_id?: string | null;
  nt_login?: string | null;
  csg?: string | null;
  mobile?: string | null;
  email?: string | null;
};

function clean(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next ? next : null;
}

function isPersonStatus(value: unknown): value is PersonStatus {
  return (
    value === "active" ||
    value === "inactive" ||
    value === "onboarding" ||
    value === "onboarding_closed"
  );
}

export async function POST(req: Request) {
  const userClient = await supabaseServer();
  const sb = await supabaseAdmin();

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

  const personId = clean(body.person_id);
  const fullName = clean(body.full_name);
  const status = body.status ?? "active";

  if (!personId || !fullName) {
    return NextResponse.json(
      { error: "Missing person_id or full_name" },
      { status: 400 }
    );
  }

  if (!isPersonStatus(status)) {
    return NextResponse.json({ error: "Invalid person status" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("people_update_identity", {
    p_person_id: personId,
    p_full_name: fullName,
    p_legal_name: clean(body.legal_name),
    p_preferred_name: clean(body.preferred_name),
    p_status: status,
    p_tech_id: clean(body.tech_id),
    p_fuse_emp_id: clean(body.fuse_emp_id),
    p_nt_login: clean(body.nt_login),
    p_csg_id: clean(body.csg),
    p_mobile: clean(body.mobile),
    p_email: clean(body.email),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.ok) {
    return NextResponse.json(
      { error: data?.error ?? "Unable to update person" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}