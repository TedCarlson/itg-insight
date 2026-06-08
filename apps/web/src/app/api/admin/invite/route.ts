// apps/web/src/app/api/admin/invite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

function str(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type InviteMeta = {
  person_id: string | null;
  assignment_id: string | null;
};

async function hasRosterManage(apiClient: any, pc_org_id: string) {
  const { data, error } = await apiClient.rpc("has_any_pc_org_permission", {
    p_pc_org_id: pc_org_id,
    p_permission_keys: ["roster_manage"],
  });
  if (error) return false;
  return Boolean(data);
}

async function nextResendCount(admin: any, input: { pc_org_id: string; assignment_id: string; email: string }) {
  // Count prior invite logs for this (org, assignment, email).
  // The current send should record that count (0 = first send, 1 = first resend, ...).
  const { count } = await admin
    .from("roster_invite_log")
    .select("invite_id", { count: "exact", head: true })
    .eq("pc_org_id", input.pc_org_id)
    .eq("assignment_id", input.assignment_id)
    .eq("email", input.email);

  return Number.isFinite(Number(count)) ? Number(count) : 0;
}

export async function POST(req: NextRequest) {
  try {
    const sb = await supabaseServer();
    const admin = supabaseAdmin();

    const {
      data: { user },
      error: userErr,
    } = await sb.auth.getUser();

    if (userErr || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const email = normalizeEmail(str(body?.email));
    const assignmentId = str(body?.assignment_id);

    if (!email || !assignmentId) {
      return NextResponse.json({ error: "email and assignment_id are required" }, { status: 400 });
    }

    // --- Load assignment context (pc_org_id + person_id) via service role ---
    const { data: assignment, error: assignmentErr } = await admin
      .from("assignment")
      .select("assignment_id, pc_org_id, person_id")
      .eq("assignment_id", assignmentId)
      .maybeSingle();

    if (assignmentErr) {
      return NextResponse.json({ error: assignmentErr.message }, { status: 500 });
    }

    const pc_org_id = str(assignment?.pc_org_id);
    const person_id = str(assignment?.person_id);

    if (!pc_org_id) {
      return NextResponse.json({ error: "Assignment missing pc_org_id" }, { status: 400 });
    }

    // --- Permission gate: owner OR roster_manage for this PC-ORG ---
    const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;

    const { data: isOwner, error: ownerErr } = await apiClient.rpc("is_owner");
    if (ownerErr) return NextResponse.json({ error: ownerErr.message }, { status: 500 });

    if (!isOwner) {
      const { data: canAccess, error: accessErr } = await apiClient.rpc("can_access_pc_org", { p_pc_org_id: pc_org_id });
      if (accessErr || !canAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const allowed = await hasRosterManage(apiClient, pc_org_id);
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // --- Invite user to Supabase Auth ---
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=invite&next=/home`;

    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        app: "teamoptix-insight",
        assignment_id: assignmentId,
        pc_org_id,
      },
    });

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 });
    }

    const invitedUserId = inviteData?.user?.id;
    if (!invitedUserId) {
      return NextResponse.json({ error: "Invite did not return a user id" }, { status: 500 });
    }

    // --- Invite log (authoritative record of "invite sent") ---
    // This avoids proxy logic like "user_profile.created_at implies invited".
    // One row per send.
    const resendCount = await nextResendCount(admin, { pc_org_id, assignment_id: assignmentId, email });

    const { error: logErr } = await admin.from("roster_invite_log").insert({
      pc_org_id,
      person_id: person_id || null,
      assignment_id: assignmentId,
      email,
      invited_by_auth_user_id: user.id,
      invited_at: new Date().toISOString(),
      resend_count: resendCount,
    });

    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 });
    }

    // --- Ensure app profile row exists/linked ---
    const meta: InviteMeta = {
      person_id: person_id || null,
      assignment_id: assignmentId,
    };

    if (person_id) {
      const { error: upsertErr } = await admin
        .from("user_profile")
        .upsert(
          {
            auth_user_id: invitedUserId,
            person_id,
            selected_pc_org_id: pc_org_id,
            status: "invited",
          },
          { onConflict: "auth_user_id" }
        );

      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
    }

    const postPasswordNext = `/roster`;

    return NextResponse.json({
      ok: true,
      emailed: true,
      invited: { email, auth_user_id: invitedUserId, ...meta },
      redirect_to: redirectTo,
      post_password_next: postPasswordNext,
    });
  } catch (e: any) {
    console.error("INVITE_ROUTE_UNCAUGHT_ERROR", e);
    return NextResponse.json({ error: "Unhandled server error", message: e?.message ?? String(e) }, { status: 500 });
  }
}
