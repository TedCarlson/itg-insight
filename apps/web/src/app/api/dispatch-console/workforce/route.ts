import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

/**
 * Dispatch access must be checked in USER context (auth.uid()).
 * Service role (supabaseAdmin) will not have auth.uid(), so it cannot be used for gating.
 */
async function requireDispatchAccess(pc_org_id: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user) {
    return { ok: false as const, status: 401 as const, error: "unauthorized" as const, user: null };
  }

  const access = await sb.rpc("has_dispatch_console_access", { p_pc_org_id: pc_org_id });
  if (access.error) {
    return { ok: false as const, status: 500 as const, error: "access_check_failed" as const, user: null };
  }

  if (access.data !== true) {
    return { ok: false as const, status: 403 as const, error: "forbidden" as const, user: null };
  }

  return { ok: true as const, status: 200 as const, error: null, user };
}

export async function GET(req: NextRequest) {
  const pc_org_id = req.nextUrl.searchParams.get("pc_org_id") ?? "";
  const shift_date = req.nextUrl.searchParams.get("shift_date") ?? "";

  if (!pc_org_id) return NextResponse.json({ ok: false, error: "missing_pc_org_id" }, { status: 400 });
  if (!shift_date || !isISODate(shift_date)) {
    return NextResponse.json({ ok: false, error: "invalid_shift_date" }, { status: 400 });
  }

  const gate = await requireDispatchAccess(pc_org_id);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const admin = supabaseAdmin();

  // Seed today's dispatch snapshot (idempotent)
  const seed = await admin.rpc("dispatch_day_seed_from_schedule", {
    p_pc_org_id: pc_org_id,
    p_shift_date: shift_date,
  });

  if (seed.error) {
    return NextResponse.json({ ok: false, error: "seed_failed", details: seed.error }, { status: 400 });
  }

  // Workforce rows
  const rowsRes = await admin
    .from("dispatch_day_tech")
    .select(
      "pc_org_id,shift_date,assignment_id,person_id,tech_id,affiliation_id,full_name,co_name,planned_route_id,planned_route_name,planned_start_time,planned_end_time,planned_hours,planned_units,sv_built,sv_route_id,sv_route_name,checked_in_at,schedule_as_of,sv_as_of,check_in_as_of"
    )
    .eq("pc_org_id", pc_org_id)
    .eq("shift_date", shift_date)
    .order("full_name", { ascending: true });

  if (rowsRes.error) {
    return NextResponse.json({ ok: false, error: "workforce_fetch_failed", details: rowsRes.error }, { status: 400 });
  }

  // Day summary
  const sumRes = await admin
    .from("dispatch_day_summary_v")
    .select("*")
    .eq("pc_org_id", pc_org_id)
    .eq("shift_date", shift_date)
    .maybeSingle();

  if (sumRes.error) {
    return NextResponse.json({ ok: false, error: "summary_fetch_failed", details: sumRes.error }, { status: 400 });
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
}