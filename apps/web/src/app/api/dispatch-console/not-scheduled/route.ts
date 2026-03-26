import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireDispatchConsoleAccess } from "../_auth";

export const runtime = "nodejs";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

function dayKeyFromISODate(shift_date: string): DayKey {
  const [y, m, d] = shift_date.split("-").map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const idx = dt.getUTCDay();
  const keys: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return keys[idx] ?? "mon";
}

export async function GET(req: NextRequest) {
  const pc_org_id = req.nextUrl.searchParams.get("pc_org_id") ?? "";
  const shift_date = req.nextUrl.searchParams.get("shift_date") ?? "";

  if (!pc_org_id) return NextResponse.json({ ok: false, error: "missing_pc_org_id" }, { status: 400 });
  if (!shift_date || !isISODate(shift_date)) {
    return NextResponse.json({ ok: false, error: "invalid_shift_date" }, { status: 400 });
  }

  const authz = await requireDispatchConsoleAccess(req, pc_org_id);
  if (!authz.ok) {
    return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });
  }

  const admin = supabaseAdmin();

  const seed = await admin.rpc("dispatch_day_seed_from_schedule", {
    p_pc_org_id: pc_org_id,
    p_shift_date: shift_date,
  });
  if (seed.error) {
    return NextResponse.json({ ok: false, error: "seed_failed", details: seed.error }, { status: 400 });
  }

  const monthRes = await admin
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label,month_key")
    .lte("start_date", shift_date)
    .gte("end_date", shift_date)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (monthRes.error) {
    return NextResponse.json({ ok: false, error: "fiscal_month_lookup_failed", details: monthRes.error }, { status: 400 });
  }
  if (!monthRes.data?.fiscal_month_id) {
    return NextResponse.json({ ok: false, error: "fiscal_month_not_found", shift_date }, { status: 404 });
  }

  const dow = dayKeyFromISODate(shift_date);

  const scheduledRes = await admin
    .from("dispatch_day_tech")
    .select("assignment_id")
    .eq("pc_org_id", pc_org_id)
    .eq("shift_date", shift_date);

  if (scheduledRes.error) {
    return NextResponse.json({ ok: false, error: "scheduled_lookup_failed", details: scheduledRes.error }, { status: 400 });
  }

  const scheduledSet = new Set<string>((scheduledRes.data ?? []).map((r: any) => String(r.assignment_id ?? "")));

  const addInExRes = await admin
    .from("schedule_exception_day")
    .select("tech_id")
    .eq("pc_org_id", pc_org_id)
    .eq("shift_date", shift_date)
    .eq("exception_type", "ADD_IN")
    .eq("approved", true)
    .eq("status", "APPROVED")
    .eq("force_off", false);

  if (addInExRes.error) {
    return NextResponse.json({ ok: false, error: "add_in_exception_lookup_failed", details: addInExRes.error }, { status: 400 });
  }

  const addInTechSet = new Set<string>(
    (addInExRes.data ?? [])
      .map((r: any) => String(r.tech_id ?? "").trim())
      .filter(Boolean)
  );

  const baseRes = await admin
    .from("schedule_baseline_month")
    .select("assignment_id,tech_id,sun,mon,tue,wed,thu,fri,sat")
    .eq("pc_org_id", pc_org_id)
    .eq("fiscal_month_id", monthRes.data.fiscal_month_id);

  if (baseRes.error) {
    return NextResponse.json({ ok: false, error: "baseline_lookup_failed", details: baseRes.error }, { status: 400 });
  }

  const offAssignmentIds = (baseRes.data ?? [])
    .map((r: any) => ({
      assignment_id: String(r.assignment_id ?? ""),
      tech_id: r.tech_id ? String(r.tech_id) : "",
      todayFlag: r[dow] as boolean | null,
    }))
    .filter((r) => r.assignment_id && r.todayFlag !== true)
    .filter((r) => !scheduledSet.has(r.assignment_id))
    .filter((r) => !addInTechSet.has(r.tech_id))
    .map((r) => r.assignment_id);

  if (offAssignmentIds.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        pc_org_id,
        shift_date,
        fiscal_month: monthRes.data,
        rows: [],
      },
      { status: 200 }
    );
  }

  const rosterRes = await admin
    .from("route_lock_roster_tech_v")
    .select("assignment_id,person_id,tech_id,full_name,co_name")
    .eq("pc_org_id", pc_org_id)
    .in("assignment_id", offAssignmentIds);

  if (rosterRes.error) {
    return NextResponse.json({ ok: false, error: "roster_lookup_failed", details: rosterRes.error }, { status: 400 });
  }

  const rows = (rosterRes.data ?? [])
    .map((r: any) => ({
      pc_org_id,
      shift_date,
      assignment_id: String(r.assignment_id ?? ""),
      person_id: r.person_id ? String(r.person_id) : "",
      tech_id: r.tech_id ? String(r.tech_id) : "",
      affiliation_id: null as string | null,
      full_name: r.full_name ?? "",
      co_name: r.co_name ?? null,

      planned_route_id: null as string | null,
      planned_route_name: null as string | null,
      planned_start_time: null as string | null,
      planned_end_time: null as string | null,
      planned_hours: null as number | null,
      planned_units: null as number | null,

      sv_built: null as boolean | null,
      sv_route_id: null as string | null,
      sv_route_name: null as string | null,

      checked_in_at: null as string | null,
      schedule_as_of: null as string | null,
      sv_as_of: null as string | null,
      check_in_as_of: null as string | null,
    }))
    .sort((a: any, b: any) => String(a.full_name ?? "").localeCompare(String(b.full_name ?? "")));

  return NextResponse.json(
    {
      ok: true,
      pc_org_id,
      shift_date,
      fiscal_month: monthRes.data,
      dow,
      rows,
    },
    { status: 200 }
  );
}