import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { Resend } from "resend";

export const runtime = "nodejs";

type InviteRequest = {
  person_id: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function asText(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function pickPrimaryEmail(raw: unknown): string | null {
  const text = asText(raw);
  if (!text) return null;

  const parts = text
    .split(/[;,]/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const firstValid = parts.find((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  return firstValid ?? null;
}

function getSiteUrl(req: NextRequest): string {
  const envUrl = asText(process.env.NEXT_PUBLIC_SITE_URL);
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

async function nextResendCount(
  admin: any,
  input: { pc_org_id: string; person_id: string; email: string }
) {
  const { count } = await admin
    .from("roster_invite_log")
    .select("invite_id", { count: "exact", head: true })
    .eq("pc_org_id", input.pc_org_id)
    .eq("person_id", input.person_id)
    .eq("email", input.email);

  return Number.isFinite(Number(count)) ? Number(count) : 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InviteRequest;

    if (!body?.person_id) {
      return bad("person_id required");
    }

    const sb = await supabaseServer();
    const admin = supabaseAdmin();

    const {
      data: { user },
      error: userErr,
    } = await sb.auth.getUser();

    if (userErr || !user) {
      return bad("unauthorized", 401);
    }

    const { data: profile, error: profileErr } = await sb
      .from("user_profile")
      .select("selected_pc_org_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileErr) {
      return bad(profileErr.message, 500);
    }

    const pc_org_id = asText(profile?.selected_pc_org_id);
    if (!pc_org_id) {
      return bad("selected_pc_org_id_missing", 400);
    }

    const { data: pass, error: passErr } = await sb.rpc("get_access_pass", {
      p_pc_org_id: pc_org_id,
    });

    if (passErr || !pass) {
      return bad("access_pass_failed", 403);
    }

    const isAllowed =
      Boolean((pass as any)?.is_app_owner) ||
      Boolean((pass as any)?.is_owner) ||
      Boolean((pass as any)?.is_admin);

    if (!isAllowed) {
      return bad("forbidden", 403);
    }

    const { data: person, error: personErr } = await admin
      .from("person")
      .select("person_id, full_name, emails")
      .eq("person_id", body.person_id)
      .maybeSingle();

    if (personErr) {
      return bad(personErr.message, 500);
    }

    if (!person) {
      return bad("person_not_found", 404);
    }

    const personEmail = pickPrimaryEmail((person as any).emails);
    if (!personEmail) {
      return bad("person_missing_email", 400);
    }

    const { data: existingProfile, error: existingProfileErr } = await admin
      .from("user_profile")
      .select("auth_user_id, status")
      .eq("person_id", body.person_id)
      .maybeSingle();

    if (existingProfileErr) {
      return bad(existingProfileErr.message, 500);
    }

    if (existingProfile?.auth_user_id && existingProfile?.status === "active") {
      return NextResponse.json({
        status: "already_active",
        email: personEmail,
      });
    }

    const siteUrl = getSiteUrl(req);
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return bad("RESEND_API_KEY missing", 500);
    }

    const inviteFromEmail =
      process.env.INVITE_FROM_EMAIL || "Insight <no-reply@mail.teamoptix.io>";

    const redirectTo = `${siteUrl}/auth/callback`;

    const { data: linkData, error: linkErr } =
      await admin.auth.admin.generateLink({
        type: "invite",
        email: personEmail,
        options: {
          redirectTo,
          data: {
            person_id: body.person_id,
            pc_org_id,
            invite_source: "person_admin",
          },
        },
      });

    if (linkErr) {
      return bad(linkErr.message, 500);
    }

    const invitedUserId = asText(linkData?.user?.id);
    const actionLink =
      asText((linkData as any)?.properties?.action_link) ??
      asText((linkData as any)?.properties?.actionLink);

    if (!actionLink) {
      return bad("invite_link_generation_failed", 500);
    }

    if (invitedUserId) {
      const patch: Record<string, any> = {
        auth_user_id: invitedUserId,
        person_id: body.person_id,
        selected_pc_org_id: pc_org_id,
      };

      const { error: upsertErr } = await admin
        .from("user_profile")
        .upsert(patch, { onConflict: "auth_user_id" });

      if (upsertErr) {
        return bad(upsertErr.message, 500);
      }
    }

    const resendCount = await nextResendCount(admin, {
      pc_org_id,
      person_id: body.person_id,
      email: personEmail,
    });

    const { error: logErr } = await admin.from("roster_invite_log").insert({
      pc_org_id,
      person_id: body.person_id,
      email: personEmail,
      invited_by_auth_user_id: user.id,
      invited_at: new Date().toISOString(),
      resend_count: resendCount,
    });

    if (logErr) {
      return bad(logErr.message, 500);
    }

    const resend = new Resend(resendKey);

    const { error: sendErr } = await resend.emails.send({
      from: inviteFromEmail,
      to: personEmail,
      subject: "You’ve been invited to Insight",
      html: `
        <p>Hello ${person.full_name ?? "there"},</p>
        <p>You’ve been invited to access <strong>Insight</strong>.</p>
        <p>Click the link below to activate your account and set your password.</p>
        <p><a href="${actionLink}">Activate your account</a></p>
        <p>If you did not expect this invite, you can ignore this email.</p>
      `,
    });

    if (sendErr) {
      return bad(sendErr.message, 500);
    }

    return NextResponse.json({
      status: "invited",
      email: personEmail,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "unknown_error" },
      { status: 500 }
    );
  }
}