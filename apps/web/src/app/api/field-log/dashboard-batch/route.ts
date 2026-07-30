import { NextRequest, NextResponse } from "next/server";
import { isTechExperienceUser } from "@/shared/access/access";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

const INTERESTS = new Set([
  "my_work",
  "review",
  "follow_up",
  "cases",
  "billing",
  "aging",
  "history",
]);

export async function GET(req: NextRequest) {
  const pcOrgId = req.nextUrl.searchParams.get("pc_org_id")?.trim() || null;
  const requestedInterest = req.nextUrl.searchParams.get("interest")?.trim() || "review";

  if (!pcOrgId) {
    return NextResponse.json({ ok: false, error: "pc_org_id is required." }, { status: 400 });
  }

  try {
    const accessPass = await requireAccessPass(req, pcOrgId);
    const selfScope = isTechExperienceUser(accessPass);
    const interest = selfScope
      ? "my_work"
      : INTERESTS.has(requestedInterest)
        ? requestedInterest
        : "review";

    const { data, error } = await supabaseAdmin().rpc("field_log_dashboard_batch", {
      p_pc_org_id: pcOrgId,
      p_auth_user_id: accessPass.auth_user_id,
      p_scope_mode: selfScope ? "self" : "org",
      p_interest: interest,
      p_window_days: 30,
      p_limit: 25,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to load Field Log dashboard." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        scope: {
          role: selfScope ? "technician" : "elevated",
          pc_org_id: pcOrgId,
          mode: selfScope ? "self" : "org",
        },
        data: data ?? {},
      },
      {
        headers: {
          "cache-control": "private, no-store",
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Forbidden." },
      { status: error?.status || 403 },
    );
  }
}
