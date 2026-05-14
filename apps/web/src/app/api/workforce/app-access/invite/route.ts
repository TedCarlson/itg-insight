// path: apps/web/src/app/api/workforce/app-access/invite/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type RequestBody = {
  assignment_id?: string;
};

type GuardOk = {
  ok: true;
  auth_user_id: string;
  selected_pc_org_id: string;
  apiClient: any;
};

type GuardFail = {
  ok: false;
  status: number;
  error: string;
};

function clean(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next ? next : null;
}

function normalizeEmail(value: unknown): string | null {
  const email = clean(value)?.toLowerCase() ?? null;
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function getSiteUrl(req: NextRequest): string {
  const envUrl = clean(process.env.NEXT_PUBLIC_SITE_URL);
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/+$/, "");

  const host = req.headers.get("host");
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}

async function hasAnyRole(
  admin: any,
  authUserId: string,
  roleKeys: string[]
): Promise<boolean> {
  const { data, error } = await admin
    .from("user_roles")
    .select("role_key")
    .eq("auth_user_id", authUserId);

  if (error) return false;

  const roles: string[] = (data ?? []).map((row: { role_key?: unknown }) =>
    String(row?.role_key ?? "")
  );

  return roles.some((role: string) => roleKeys.includes(role));
}

async function guardWorkforceInvite(): Promise<GuardOk | GuardFail> {
  const sb = await supabaseServer();
  const admin = supabaseAdmin();

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (userErr || !user?.id) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const { data: profile, error: profileErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileErr) {
    return { ok: false, status: 500, error: profileErr.message };
  }

  const selectedPcOrgId = clean(profile?.selected_pc_org_id);
  if (!selectedPcOrgId) {
    return { ok: false, status: 409, error: "selected_pc_org_id_missing" };
  }

  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;

  const { data: canAccess, error: accessErr } = await apiClient.rpc(
    "can_access_pc_org",
    { p_pc_org_id: selectedPcOrgId }
  );

  if (accessErr || !canAccess) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  const { data: isOwner, error: ownerErr } = await apiClient.rpc("is_owner");
  if (ownerErr) {
    return { ok: false, status: 500, error: ownerErr.message };
  }

  if (isOwner) {
    return {
      ok: true,
      auth_user_id: user.id,
      selected_pc_org_id: selectedPcOrgId,
      apiClient,
    };
  }

  const roleAllowed = await hasAnyRole(admin, user.id, [
    "admin",
    "dev",
    "director",
    "manager",
    "vp",
  ]);

  if (roleAllowed) {
    return {
      ok: true,
      auth_user_id: user.id,
      selected_pc_org_id: selectedPcOrgId,
      apiClient,
    };
  }

  const { data: grantAllowed, error: grantErr } = await apiClient.rpc(
    "has_any_pc_org_permission",
    {
      p_pc_org_id: selectedPcOrgId,
      p_permission_keys: ["roster_manage"],
    }
  );

  if (grantErr || !grantAllowed) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return {
    ok: true,
    auth_user_id: user.id,
    selected_pc_org_id: selectedPcOrgId,
    apiClient,
  };
}

async function nextResendCount(
  admin: any,
  input: { pc_org_id: string; assignment_id: string; person_id: string; email: string }
) {
  const { count } = await admin
    .from("roster_invite_log")
    .select("invite_id", { count: "exact", head: true })
    .eq("pc_org_id", input.pc_org_id)
    .eq("assignment_id", input.assignment_id)
    .eq("person_id", input.person_id)
    .eq("email", input.email);

  return Number.isFinite(Number(count)) ? Number(count) : 0;
}

export async function POST(req: NextRequest) {
  try {
    const guard = await guardWorkforceInvite();
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const assignmentId = clean(body.assignment_id);
    if (!assignmentId) {
      return NextResponse.json({ ok: false, error: "assignment_id_required" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: workforceRow, error: workforceErr } = await admin
      .from("workforce_current_v")
      .select("assignment_id, person_id, pc_org_id, full_name, email")
      .eq("assignment_id", assignmentId)
      .eq("pc_org_id", guard.selected_pc_org_id)
      .maybeSingle();

    if (workforceErr) {
      return NextResponse.json({ ok: false, error: workforceErr.message }, { status: 500 });
    }

    if (!workforceRow?.assignment_id) {
      return NextResponse.json({ ok: false, error: "assignment_not_found" }, { status: 404 });
    }

    const personId = clean(workforceRow.person_id);
    const pcOrgId = clean(workforceRow.pc_org_id);
    const email = normalizeEmail(workforceRow.email);

    if (!personId || !pcOrgId) {
      return NextResponse.json({ ok: false, error: "assignment_missing_person_or_org" }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ ok: false, error: "person_missing_valid_email" }, { status: 400 });
    }

    const { data: existingProfile, error: existingProfileErr } = await admin
      .from("user_profile")
      .select("auth_user_id, person_id, status")
      .eq("person_id", personId)
      .maybeSingle();

    if (existingProfileErr) {
      return NextResponse.json({ ok: false, error: existingProfileErr.message }, { status: 500 });
    }

    if (existingProfile?.auth_user_id) {
      const { data: authData } = await admin.auth.admin.getUserById(
        existingProfile.auth_user_id
      );

      if (authData?.user?.last_sign_in_at) {
        return NextResponse.json({
          ok: true,
          status: "already_active",
          app_access_status: "active",
          auth_user_id: existingProfile.auth_user_id,
          invite_email: email,
          invite_accepted_at: authData.user.last_sign_in_at,
        });
      }
    }

    const resendKey = clean(process.env.RESEND_API_KEY);
    if (!resendKey) {
      return NextResponse.json({ ok: false, error: "RESEND_API_KEY_missing" }, { status: 500 });
    }

    const siteUrl = getSiteUrl(req);
    const redirectTo = `${siteUrl}/auth/callback`;
    const inviteFromEmail =
      clean(process.env.INVITE_FROM_EMAIL) ?? "Insight <no-reply@mail.teamoptix.io>";

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: {
          app: "teamoptix-insight",
          assignment_id: assignmentId,
          person_id: personId,
          pc_org_id: pcOrgId,
          invite_source: "workforce",
        },
      },
    });

    if (linkErr) {
      return NextResponse.json({ ok: false, error: linkErr.message }, { status: 500 });
    }

    const invitedUserId = clean(linkData?.user?.id);
    const actionLink =
      clean((linkData as any)?.properties?.action_link) ??
      clean((linkData as any)?.properties?.actionLink);

    if (!invitedUserId || !actionLink) {
      return NextResponse.json({ ok: false, error: "invite_link_generation_failed" }, { status: 500 });
    }

    const { data: profileConflict, error: conflictErr } = await admin
      .from("user_profile")
      .select("auth_user_id, person_id")
      .eq("auth_user_id", invitedUserId)
      .maybeSingle();

    if (conflictErr) {
      return NextResponse.json({ ok: false, error: conflictErr.message }, { status: 500 });
    }

    const conflictPersonId = clean(profileConflict?.person_id);
    if (conflictPersonId && conflictPersonId !== personId) {
      return NextResponse.json(
        { ok: false, error: "profile_mismatch", app_access_status: "profile_mismatch" },
        { status: 409 }
      );
    }

    const { error: upsertErr } = await admin.from("user_profile").upsert(
      {
        auth_user_id: invitedUserId,
        person_id: personId,
        selected_pc_org_id: pcOrgId,
        status: "pending",
      },
      { onConflict: "auth_user_id" }
    );

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
    }

    const invitedAt = new Date().toISOString();
    const resendCount = await nextResendCount(admin, {
      pc_org_id: pcOrgId,
      assignment_id: assignmentId,
      person_id: personId,
      email,
    });

    const { error: logErr } = await admin.from("roster_invite_log").insert({
      pc_org_id: pcOrgId,
      person_id: personId,
      assignment_id: assignmentId,
      email,
      invited_by_auth_user_id: guard.auth_user_id,
      invited_at: invitedAt,
      resend_count: resendCount,
    });

    if (logErr) {
      return NextResponse.json({ ok: false, error: logErr.message }, { status: 500 });
    }

    const resend = new Resend(resendKey);
    const { error: sendErr } = await resend.emails.send({
      from: inviteFromEmail,
      to: email,
      subject: "You’ve been invited to Insight",
      html: `
        <p>Hello ${workforceRow.full_name ?? "there"},</p>
        <p>You’ve been invited to access <strong>Insight</strong>.</p>
        <p>Click the link below to activate your account and set your password.</p>
        <p><a href="${actionLink}">Activate your account</a></p>
        <p>If you did not expect this invite, you can ignore this email.</p>
      `,
    });

    if (sendErr) {
      return NextResponse.json({ ok: false, error: sendErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      status: "invited",
      app_access_status: "invited_pending",
      auth_user_id: invitedUserId,
      invite_email: email,
      invite_last_sent_at: invitedAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "unknown_error" },
      { status: 500 }
    );
  }
}
