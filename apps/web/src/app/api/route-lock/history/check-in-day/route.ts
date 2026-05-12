// path: apps/web/src/app/api/route-lock/history/check-in-day/route.ts

import { NextResponse, type NextRequest } from "next/server";

import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { requireModule } from "@/shared/access/access";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";
import { getTechCheckInDayHistory } from "@/shared/server/route-lock/check-in/checkInDayHistoryService.server";

export const runtime = "nodejs";

function json(status: number, payload: unknown) {
  return NextResponse.json(payload, { status });
}

function errorPayload(error: unknown) {
  const e = error as any;

  return {
    ok: false,
    error: String(e?.message ?? "server_error"),
    hint: e?.hint ?? undefined,
    detail: e?.detail ?? e?.stack ?? undefined,
  };
}

async function resolveSelectedPcOrg(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }

  const admin = supabaseAdmin();

  const { data: profile, error: profileErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileErr) {
    return { ok: false as const, status: 500, error: profileErr.message };
  }

  const pcOrgId = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pcOrgId) {
    return { ok: false as const, status: 409, error: "no selected org" };
  }

  try {
    const pass = await requireAccessPass(req, pcOrgId);
    requireModule(pass, "route_lock");
    return { ok: true as const, pcOrgId };
  } catch (err: any) {
    const status = Number(err?.status ?? 500);
    if (status === 401) return { ok: false as const, status: 401, error: "unauthorized" };
    if (status === 403) return { ok: false as const, status: 403, error: "forbidden" };
    if (status === 400) return { ok: false as const, status: 400, error: String(err?.message ?? "invalid_pc_org_id") };
    return { ok: false as const, status: 500, error: "access_error" };
  }
}

export async function GET(req: NextRequest) {
  try {
    const guard = await resolveSelectedPcOrg(req);
    if (!guard.ok) {
      return json(guard.status, { ok: false, error: guard.error });
    }

    const result = await getTechCheckInDayHistory({
      admin: supabaseAdmin(),
      pcOrgId: guard.pcOrgId,
      assignmentId: req.nextUrl.searchParams.get("assignment_id"),
      shiftDate: req.nextUrl.searchParams.get("shift_date"),
    });

    return json(200, result);
  } catch (error: any) {
    return json(Number(error?.status ?? 500), errorPayload(error));
  }
}