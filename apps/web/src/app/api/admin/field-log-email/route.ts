import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

const FALLBACK_EMAIL = "Comcast_Billing@itgcomm.com";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function requireUserOrg() {
  const sb = await supabaseServer();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();

  if (error || !user) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 }) };
  }

  const admin = supabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: profileError.message }, { status: 500 }) };
  }

  const pcOrgId = clean(profile?.selected_pc_org_id);
  if (!pcOrgId) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "No selected PC org." }, { status: 400 }) };
  }

  return { ok: true as const, admin, user, pcOrgId };
}

export async function GET() {
  const gate = await requireUserOrg();
  if (!gate.ok) return gate.res;

  const { data, error } = await gate.admin
    .from("field_log_billing_email_recipient")
    .select("id,email,enabled,created_at")
    .eq("pc_org_id", gate.pcOrgId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    pcOrgId: gate.pcOrgId,
    fallbackEmail: FALLBACK_EMAIL,
    recipients: data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireUserOrg();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => null);
  const email = clean(body?.email).toLowerCase();
  const enabled = body?.enabled !== false;

  if (!email || !isEmail(email)) {
    return NextResponse.json({ ok: false, error: "Valid email is required." }, { status: 400 });
  }

  const { data, error } = await gate.admin
    .from("field_log_billing_email_recipient")
    .upsert(
      {
        pc_org_id: gate.pcOrgId,
        email,
        enabled,
        created_by_user_id: gate.user.id,
      },
      { onConflict: "pc_org_id,email" },
    )
    .select("id,email,enabled,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, recipient: data });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireUserOrg();
  if (!gate.ok) return gate.res;

  const id = clean(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id is required." }, { status: 400 });

  const { error } = await gate.admin
    .from("field_log_billing_email_recipient")
    .delete()
    .eq("pc_org_id", gate.pcOrgId)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
