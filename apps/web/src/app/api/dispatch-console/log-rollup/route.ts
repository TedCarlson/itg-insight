import { NextResponse, type NextRequest } from "next/server";

import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { requireModule } from "@/shared/access/access";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type EventType = "CALL_OUT" | "ADD_IN" | "BP_LOW" | "INCIDENT" | "NOTE" | "TECH_MOVE";

type RollupRow = {
  assignment_id: string | null;
  event_type: EventType;
  count: number;
  capacity_delta_total: number;
};

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function jsonError(status: number, payload: unknown) {
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

    const { data, error } = await admin
      .from("dispatch_console_log")
      .select("assignment_id,event_type,capacity_delta_routes")
      .eq("pc_org_id", pc_org_id)
      .eq("shift_date", shift_date);

    if (error) {
      return jsonError(400, {
        ok: false,
        error: "rollup_fetch_failed",
        details: error,
      });
    }

    const byAssignmentEvent = new Map<string, RollupRow>();

    const rollup = {
      call_out: 0,
      add_in: 0,
      bp_low: 0,
      incident: 0,
      tech_move: 0,
      notes: 0,
      capacity_delta_total: 0,
    };

    for (const row of data ?? []) {
      const assignmentId = String((row as any).assignment_id ?? "").trim();
      const eventType = String((row as any).event_type ?? "") as EventType;
      const delta = Number((row as any).capacity_delta_routes ?? 0);

      if (eventType === "CALL_OUT") rollup.call_out += 1;
      if (eventType === "ADD_IN") rollup.add_in += 1;
      if (eventType === "BP_LOW") rollup.bp_low += 1;
      if (eventType === "INCIDENT") rollup.incident += 1;
      if (eventType === "TECH_MOVE") rollup.tech_move += 1;
      if (eventType === "NOTE") rollup.notes += 1;

      rollup.capacity_delta_total += Number.isFinite(delta) ? delta : 0;

      if (!assignmentId) continue;

      const key = `${assignmentId}:${eventType}`;
      const existing =
        byAssignmentEvent.get(key) ??
        ({
          assignment_id: assignmentId,
          event_type: eventType,
          count: 0,
          capacity_delta_total: 0,
        } satisfies RollupRow);

      existing.count += 1;
      existing.capacity_delta_total += Number.isFinite(delta) ? delta : 0;
      byAssignmentEvent.set(key, existing);
    }

    return NextResponse.json(
      {
        ok: true,
        rows: Array.from(byAssignmentEvent.values()),
        rollup,
      },
      { status: 200 },
    );
  } catch (err) {
    return asAccessError(err);
  }
}