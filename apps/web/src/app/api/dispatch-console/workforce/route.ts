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

    const baseRows = (rowsRes.data ?? []) as any[];
    const byAssignment = new Map<string, any>();

    for (const row of baseRows) {
      const assignmentId = String(row.assignment_id ?? "").trim();
      if (!assignmentId) continue;
      byAssignment.set(assignmentId, row);
    }

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
      return jsonError(400, { ok: false, error: "add_in_exception_lookup_failed", details: addInExRes.error });
    }

    const addInTechIds = Array.from(
      new Set(
        (addInExRes.data ?? [])
          .map((r: any) => String(r.tech_id ?? "").trim())
          .filter(Boolean)
      )
    );

    if (addInTechIds.length > 0) {
      const rosterRes = await admin
        .from("route_lock_roster_tech_v")
        .select("assignment_id,person_id,tech_id,full_name,co_name")
        .eq("pc_org_id", pc_org_id)
        .in("tech_id", addInTechIds);

      if (rosterRes.error) {
        return jsonError(400, { ok: false, error: "add_in_roster_lookup_failed", details: rosterRes.error });
      }

      for (const r of rosterRes.data ?? []) {
        const assignmentId = String((r as any).assignment_id ?? "").trim();
        if (!assignmentId) continue;
        if (byAssignment.has(assignmentId)) continue;

        byAssignment.set(assignmentId, {
          pc_org_id,
          shift_date,
          assignment_id: assignmentId,
          person_id: (r as any).person_id ? String((r as any).person_id) : "",
          tech_id: (r as any).tech_id ? String((r as any).tech_id) : "",
          affiliation_id: null,
          full_name: (r as any).full_name ?? "",
          co_name: (r as any).co_name ?? null,

          planned_route_id: null,
          planned_route_name: null,
          planned_start_time: null,
          planned_end_time: null,
          planned_hours: null,
          planned_units: null,

          sv_built: null,
          sv_route_id: null,
          sv_route_name: null,

          checked_in_at: null,
          schedule_as_of: null,
          sv_as_of: null,
          check_in_as_of: null,
        });
      }
    }

    const rows = Array.from(byAssignment.values()).sort((a: any, b: any) =>
      String(a.full_name ?? "").localeCompare(String(b.full_name ?? ""))
    );

    return NextResponse.json(
      {
        ok: true,
        seeded: seed.data ?? 0,
        summary: sumRes.data ?? null,
        rows,
      },
      { status: 200 }
    );
  } catch (err) {
    return asAccessError(err);
  }
}