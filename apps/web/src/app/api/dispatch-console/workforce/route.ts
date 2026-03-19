import { NextResponse, type NextRequest } from "next/server";

import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { requireModule } from "@/shared/access/access";

import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function jsonError(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function asAccessError(err: unknown) {
  const status = (err as any)?.status ?? 500;
  const message = String((err as any)?.message ?? "server_error");

  if (status === 401) return jsonError(401, { ok: false, error: "unauthorized" });
  if (status === 403) return jsonError(403, { ok: false, error: "forbidden" });
  if (status === 400) return jsonError(400, { ok: false, error: message });

  return jsonError(500, { ok: false, error: "server_error" });
}

export async function GET(req: NextRequest) {
  try {
    const pc_org_id = req.nextUrl.searchParams.get("pc_org_id") ?? "";
    const shift_date = req.nextUrl.searchParams.get("shift_date") ?? "";

    if (!pc_org_id) return jsonError(400, { ok: false, error: "missing_pc_org_id" });
    if (!shift_date || !isISODate(shift_date)) {
      return jsonError(400, { ok: false, error: "invalid_shift_date" });
    }

    const pass = await requireAccessPass(req, pc_org_id);
    requireModule(pass, "dispatch_console");

    const admin = supabaseAdmin();

    const seed = await admin.rpc("dispatch_day_seed_from_schedule", {
      p_pc_org_id: pc_org_id,
      p_shift_date: shift_date,
    });

    if (seed.error) {
      return jsonError(400, { ok: false, error: "seed_failed", details: seed.error });
    }

    const rowsRes = await admin
      .from("dispatch_day_tech")
      .select(
        "pc_org_id,shift_date,assignment_id,person_id,tech_id,affiliation_id,full_name,co_name,planned_route_id,planned_route_name,planned_start_time,planned_end_time,planned_hours,planned_units,sv_built,sv_route_id,sv_route_name,checked_in_at,schedule_as_of,sv_as_of,check_in_as_of"
      )
      .eq("pc_org_id", pc_org_id)
      .eq("shift_date", shift_date)
      .order("full_name", { ascending: true });

    if (rowsRes.error) {
      return jsonError(400, { ok: false, error: "workforce_fetch_failed", details: rowsRes.error });
    }

    const sumRes = await admin
      .from("dispatch_day_summary_v")
      .select("*")
      .eq("pc_org_id", pc_org_id)
      .eq("shift_date", shift_date)
      .maybeSingle();

    if (sumRes.error) {
      return jsonError(400, { ok: false, error: "summary_fetch_failed", details: sumRes.error });
    }

    return NextResponse.json(
      {
        ok: true,
        seeded: seed.data ?? 0,
        summary: sumRes.data ?? null,
        rows: rowsRes.data ?? [],
      },
      { status: 200 }
    );
  } catch (err) {
    return asAccessError(err);
  }
}