// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/route-lock/schedule/upsert/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
type DayFlags = Record<DayKey, boolean>;

type ScheduleWriteRow = {
  assignment_id: string;
  tech_id: string;
  default_route_id?: string | null;
  days: DayFlags;
};

function asUuid(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return null;
  return s;
}

function bool(v: unknown): boolean {
  return v === true;
}

function normalizeDays(days: any): DayFlags {
  return {
    sun: bool(days?.sun),
    mon: bool(days?.mon),
    tue: bool(days?.tue),
    wed: bool(days?.wed),
    thu: bool(days?.thu),
    fri: bool(days?.fri),
    sat: bool(days?.sat),
  };
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampNonNeg(n: number): number {
  return n < 0 ? 0 : n;
}

async function guardSelectedOrgRouteLockManage() {
  const sb = await supabaseServer();
  const admin = supabaseAdmin();

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) return { ok: false as const, status: 401, error: "unauthorized" };

  const { data: profile, error: profErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profErr) return { ok: false as const, status: 500, error: profErr.message };

  const pc_org_id = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pc_org_id) return { ok: false as const, status: 409, error: "no selected org" };

  // Owner always allowed
  const { data: isOwner, error: ownerErr } = await sb.rpc("is_owner");
  if (ownerErr) return { ok: false as const, status: 403, error: "forbidden" };
  if (isOwner) return { ok: true as const, pc_org_id, auth_user_id: user.id };

  // Route Lock write gate (preferred) OR Roster Manage (legacy bridge)
  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;
  const { data: allowed, error: permErr } = await apiClient.rpc("has_any_pc_org_permission", {
    p_pc_org_id: pc_org_id,
    p_permission_keys: ["route_lock_manage", "roster_manage"],
  });

  if (permErr || !allowed) return { ok: false as const, status: 403, error: "forbidden" };

  return { ok: true as const, pc_org_id, auth_user_id: user.id };
}

export async function POST(req: Request) {
  try {
    const guard = await guardSelectedOrgRouteLockManage();
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

    const body = await req.json().catch(() => null);

    const fiscal_month_id = asUuid(body?.fiscal_month_id);
    if (!fiscal_month_id) {
      return NextResponse.json({ ok: false, error: "Missing/invalid fiscal_month_id (UUID)" }, { status: 400 });
    }

    const hoursPerDay = clampNonNeg(num(body?.hoursPerDay, 8));
    const unitsPerHour = clampNonNeg(num(body?.unitsPerHour, 12));

    const rows = (body?.rows ?? []) as ScheduleWriteRow[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "No rows provided" }, { status: 400 });
    }

    const clean = rows.map((r) => ({
      assignment_id: asUuid(r.assignment_id),
      tech_id: String(r.tech_id ?? "").trim(),
      default_route_id: r.default_route_id == null ? null : asUuid(r.default_route_id),
      days: normalizeDays(r.days),
    }));

    if (clean.some((r) => !r.assignment_id)) {
      return NextResponse.json({ ok: false, error: "Invalid assignment_id (must be UUID)" }, { status: 400 });
    }
    if (clean.some((r) => !r.tech_id)) {
      return NextResponse.json({ ok: false, error: "Missing tech_id (must be non-empty text)" }, { status: 400 });
    }
    if (clean.some((r) => r.default_route_id === undefined)) {
      return NextResponse.json(
        { ok: false, error: "Invalid default_route_id (must be UUID or null)" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    // Validate assignment belongs to selected org (independent of schedule rows existing)
    const assignmentIds = Array.from(new Set(clean.map((r) => r.assignment_id!).filter(Boolean)));

    const { data: allowedAssignments, error: allowedErr } = await admin
      .from("assignment")
      .select("assignment_id")
      .eq("pc_org_id", guard.pc_org_id)
      .in("assignment_id", assignmentIds);

    if (allowedErr) return NextResponse.json({ ok: false, error: allowedErr.message }, { status: 500 });

    const allowedSet = new Set((allowedAssignments ?? []).map((x: any) => String(x.assignment_id)));
    const rejected = assignmentIds.filter((id) => !allowedSet.has(String(id)));
    if (rejected.length) {
      return NextResponse.json(
        { ok: false, error: "One or more assignments are not in your selected org", rejected_assignment_ids: rejected },
        { status: 403 }
      );
    }

    // Upsert per-row WITHOUT guessing unique constraints (safe + compatible)
    let rows_inserted = 0;
    let rows_updated = 0;

    for (const r of clean) {
      const sch_hours_sun = r.days.sun ? hoursPerDay : 0;
      const sch_hours_mon = r.days.mon ? hoursPerDay : 0;
      const sch_hours_tue = r.days.tue ? hoursPerDay : 0;
      const sch_hours_wed = r.days.wed ? hoursPerDay : 0;
      const sch_hours_thu = r.days.thu ? hoursPerDay : 0;
      const sch_hours_fri = r.days.fri ? hoursPerDay : 0;
      const sch_hours_sat = r.days.sat ? hoursPerDay : 0;

      const sch_units_sun = sch_hours_sun * unitsPerHour;
      const sch_units_mon = sch_hours_mon * unitsPerHour;
      const sch_units_tue = sch_hours_tue * unitsPerHour;
      const sch_units_wed = sch_hours_wed * unitsPerHour;
      const sch_units_thu = sch_hours_thu * unitsPerHour;
      const sch_units_fri = sch_hours_fri * unitsPerHour;
      const sch_units_sat = sch_hours_sat * unitsPerHour;

      // Find existing baseline row for (org, fiscal_month, assignment)
      const { data: existing, error: exErr } = await admin
        .from("schedule_baseline_month")
        .select("schedule_baseline_month_id")
        .eq("pc_org_id", guard.pc_org_id)
        .eq("fiscal_month_id", fiscal_month_id)
        .eq("assignment_id", r.assignment_id!)
        .maybeSingle();

      if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });

      const payload: any = {
        pc_org_id: guard.pc_org_id,
        fiscal_month_id,
        tech_id: r.tech_id,
        assignment_id: r.assignment_id!,
        default_route_id: r.default_route_id ?? null,

        sun: r.days.sun,
        mon: r.days.mon,
        tue: r.days.tue,
        wed: r.days.wed,
        thu: r.days.thu,
        fri: r.days.fri,
        sat: r.days.sat,

        sch_hours_sun,
        sch_hours_mon,
        sch_hours_tue,
        sch_hours_wed,
        sch_hours_thu,
        sch_hours_fri,
        sch_hours_sat,

        sch_units_sun,
        sch_units_mon,
        sch_units_tue,
        sch_units_wed,
        sch_units_thu,
        sch_units_fri,
        sch_units_sat,

        is_active: true,
        updated_by: guard.auth_user_id,
        updated_at: new Date().toISOString(),
      };

      if (existing?.schedule_baseline_month_id) {
        const { error: upErr } = await admin
          .from("schedule_baseline_month")
          .update(payload)
          .eq("schedule_baseline_month_id", existing.schedule_baseline_month_id);

        if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
        rows_updated += 1;
      } else {
        payload.created_at = new Date().toISOString();
        const { error: insErr } = await admin.from("schedule_baseline_month").insert(payload);
        if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
        rows_inserted += 1;
      }
    }

    // ✅ New rule: any sweep runs ALL sweeps
    const { data: sweepRes, error: sweepErr } = await admin.rpc("route_lock_sweep_month", {
      p_pc_org_id: guard.pc_org_id,
      p_fiscal_month_id: fiscal_month_id,
    });

    if (sweepErr) return NextResponse.json({ ok: false, error: sweepErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      pc_org_id: guard.pc_org_id,
      fiscal_month_id,
      rows_inserted,
      rows_updated,
      rows_total_written: rows_inserted + rows_updated,
      sweep: sweepRes ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "unknown error") }, { status: 500 });
  }
}