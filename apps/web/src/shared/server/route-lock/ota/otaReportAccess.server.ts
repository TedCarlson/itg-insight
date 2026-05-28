// path: apps/web/src/shared/server/route-lock/ota/otaReportAccess.server.ts

import type { NextRequest } from "next/server";

import { requireModule } from "@/shared/access/access";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

export type OtaReportAccess = {
  pcOrgId: string;
};

export async function resolveOtaReportAccess(req: NextRequest): Promise<OtaReportAccess> {
  const sb = await supabaseServer();

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: profile, error: profileErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileErr) {
    throw Object.assign(new Error(profileErr.message), { status: 500 });
  }

  const pcOrgId = String(profile?.selected_pc_org_id ?? "").trim();

  if (!pcOrgId) {
    throw Object.assign(new Error("no selected org"), { status: 409 });
  }

  const pass = await requireAccessPass(req, pcOrgId);
  requireModule(pass, "route_lock");

  return { pcOrgId };
}
