import { NextResponse, type NextRequest } from "next/server";

import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { requireModule } from "@/shared/access/access";

import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type EventType = "CALL_OUT" | "ADD_IN" | "BP_LOW" | "INCIDENT" | "NOTE" | "TECH_MOVE";

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

    if (!pc_org_id) {
      return jsonError(400, { ok: false, error: "missing_pc_org_id" });
    }

    if (!shift_date || !isISODate(shift_date)) {
      return jsonError(400, { ok: false, error: "invalid_shift_date" });
    }

    const pass = await requireAccessPass(req, pc_org_id);
    requireModule(pass, "dispatch_console");

    const admin = supabaseAdmin();

    const res = await admin
      .from("dispatch_console_log")
      .select("event_type, capacity_delta_routes")
      .eq("pc_org_id", pc_org_id)
      .eq("shift_date", shift_date);

    if (res.error) {
      return jsonError(400, { ok: false, error: "rollup_fetch_failed", supabase: res.error });
    }

    const rows = res.data ?? [];

    let call_out = 0;
    let add_in = 0;
    let bp_low = 0;
    let incident = 0;
    let tech_move = 0;
    let notes = 0;
    let capacity_delta_total = 0;

    for (const r of rows) {
      const t = r.event_type as EventType;

      if (t === "CALL_OUT") call_out++;
      if (t === "ADD_IN") add_in++;
      if (t === "BP_LOW") bp_low++;
      if (t === "INCIDENT") incident++;
      if (t === "TECH_MOVE") tech_move++;
      if (t === "NOTE") notes++;

      capacity_delta_total += Number(r.capacity_delta_routes ?? 0);
    }

    return NextResponse.json(
      {
        ok: true,
        rollup: {
          call_out,
          add_in,
          bp_low,
          incident,
          tech_move,
          notes,
          capacity_delta_total,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    return asAccessError(err);
  }
}