// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/route-lock/schedule/upsert/route.ts

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireSelectedPcOrgServer } from "@/shared/lib/auth/requireSelectedPcOrg.server";

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

function asBool(v: unknown): boolean {
  return v === true;
}

function allDaysOff(days: Record<DayKey, boolean>) {
  return !days.sun && !days.mon && !days.tue && !days.wed && !days.thu && !days.fri && !days.sat;
}

export async function POST(req: Request) {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const pc_org_id = scope.selected_pc_org_id;
  const sb = supabaseAdmin();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const fiscal_month_id = String(body?.fiscal_month_id ?? "");
  const hoursPerDay = Number(body?.hoursPerDay ?? 8);
  const unitsPerHour = Number(body?.unitsPerHour ?? 12);
  const rows = Array.isArray(body?.rows) ? body.rows : [];

  if (!fiscal_month_id) {
    return NextResponse.json({ ok: false, error: "Missing fiscal_month_id" }, { status: 400 });
  }
  if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0) {
    return NextResponse.json({ ok: false, error: "hoursPerDay must be a positive number" }, { status: 400 });
  }
  if (!Number.isFinite(unitsPerHour) || unitsPerHour <= 0) {
    return NextResponse.json({ ok: false, error: "unitsPerHour must be a positive number" }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json(
      { ok: true, note: "No rows submitted", baseline: { inserted: 0, updated: 0 }, sweep: null },
      { status: 200 }
    );
  }

  const unitsPerDay = hoursPerDay * unitsPerHour;

  // Determine which assignment_ids already exist for this month (to compute inserted vs updated)
  const assignmentIds = rows
    .map((r: any) => String(r?.assignment_id ?? ""))
    .filter(Boolean);

  const { data: existing, error: existingErr } = await sb
    .from("schedule_baseline_month")
    .select("assignment_id")
    .eq("pc_org_id", pc_org_id)
    .eq("fiscal_month_id", fiscal_month_id)
    .in("assignment_id", assignmentIds);

  if (existingErr) {
    return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 });
  }

  const existingSet = new Set((existing ?? []).map((x) => String((x as any).assignment_id)));

  // Build baseline upsert rows
  const upsertRows = rows.map((r: any) => {
    const assignment_id = String(r?.assignment_id ?? "");
    const tech_id = String(r?.tech_id ?? "");
    const default_route_id = r?.default_route_id ? String(r.default_route_id) : null;

    const daysIn = r?.days ?? {};
    const days: Record<DayKey, boolean> = {
      sun: asBool(daysIn.sun),
      mon: asBool(daysIn.mon),
      tue: asBool(daysIn.tue),
      wed: asBool(daysIn.wed),
      thu: asBool(daysIn.thu),
      fri: asBool(daysIn.fri),
      sat: asBool(daysIn.sat),
    };

    const shouldDeactivate = allDaysOff(days) && !default_route_id;

    return {
      pc_org_id,
      fiscal_month_id,
      assignment_id,
      tech_id,

      default_route_id,

      sun: days.sun,
      mon: days.mon,
      tue: days.tue,
      wed: days.wed,
      thu: days.thu,
      fri: days.fri,
      sat: days.sat,

      // uniform weekday plan for now
      sch_hours_sun: hoursPerDay,
      sch_hours_mon: hoursPerDay,
      sch_hours_tue: hoursPerDay,
      sch_hours_wed: hoursPerDay,
      sch_hours_thu: hoursPerDay,
      sch_hours_fri: hoursPerDay,
      sch_hours_sat: hoursPerDay,

      sch_units_sun: unitsPerDay,
      sch_units_mon: unitsPerDay,
      sch_units_tue: unitsPerDay,
      sch_units_wed: unitsPerDay,
      sch_units_thu: unitsPerDay,
      sch_units_fri: unitsPerDay,
      sch_units_sat: unitsPerDay,

      is_active: !shouldDeactivate,
    };
  });

  const inserted = upsertRows.reduce((acc: number, r: any) => acc + (existingSet.has(r.assignment_id) ? 0 : 1), 0);
  const updated = upsertRows.length - inserted;

  const { error: upsertErr } = await sb
    .from("schedule_baseline_month")
    .upsert(upsertRows, { onConflict: "pc_org_id,fiscal_month_id,assignment_id" });

  if (upsertErr) {
    return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
  }

  const { data: sweep, error: sweepErr } = await sb.rpc("schedule_sweep_month", {
    p_pc_org_id: pc_org_id,
    p_fiscal_month_id: fiscal_month_id,
  });

  if (sweepErr) {
    return NextResponse.json(
      { ok: false, error: `Baseline saved but sweep failed: ${sweepErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    baseline: { inserted, updated },
    sweep,
  });
}