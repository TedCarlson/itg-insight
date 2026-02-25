// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/dispatch-console/log/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type EventType = "CALL_OUT" | "ADD_IN" | "INCIDENT" | "NOTE" | "TECH_MOVE";
const EVENT_TYPES: EventType[] = ["CALL_OUT", "ADD_IN", "INCIDENT", "NOTE", "TECH_MOVE"];

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function deltaForEventType(t: EventType): number {
  if (t === "CALL_OUT") return -1;
  if (t === "ADD_IN") return 1;
  // INCIDENT / NOTE / TECH_MOVE do not change capacity
  return 0;
}

async function requireDispatchAccess(pc_org_id: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user) {
    return { ok: false as const, status: 401 as const, error: "unauthorized" as const, user: null };
  }

  // IMPORTANT:
  // api.has_pc_org_permission() relies on auth.uid()
  // so it MUST run through the user-scoped client (supabaseServer), not service role.
  const perm = await sb.schema("api").rpc("has_pc_org_permission", {
    p_pc_org_id: pc_org_id,
    p_permission_key: "dispatch_manage",
  });

  if (perm.error) {
    return { ok: false as const, status: 500 as const, error: "permission_check_failed" as const, user: null };
  }

  if (!perm.data) {
    return { ok: false as const, status: 403 as const, error: "forbidden" as const, user: null };
  }

  return { ok: true as const, status: 200 as const, error: null, user };
}

export async function GET(req: NextRequest) {
  const pc_org_id = req.nextUrl.searchParams.get("pc_org_id") ?? "";
  const shift_date = req.nextUrl.searchParams.get("shift_date") ?? "";
  const event_type = req.nextUrl.searchParams.get("event_type") ?? "";
  const assignment_id = req.nextUrl.searchParams.get("assignment_id") ?? "";

  if (!pc_org_id) return NextResponse.json({ ok: false, error: "missing_pc_org_id" }, { status: 400 });
  if (!shift_date || !isISODate(shift_date)) {
    return NextResponse.json({ ok: false, error: "invalid_shift_date" }, { status: 400 });
  }

  const gate = await requireDispatchAccess(pc_org_id);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const admin = supabaseAdmin();

  let q = admin
    .from("dispatch_console_log")
    .select(
      "dispatch_console_log_id,pc_org_id,shift_date,assignment_id,person_id,tech_id,affiliation_id,event_type,capacity_delta_routes,message,tags,meta,created_at,created_by_user_id"
    )
    .eq("pc_org_id", pc_org_id)
    .eq("shift_date", shift_date)
    .order("created_at", { ascending: false });

  if (event_type) {
    if (!EVENT_TYPES.includes(event_type as EventType)) {
      return NextResponse.json({ ok: false, error: "invalid_event_type" }, { status: 400 });
    }
    q = q.eq("event_type", event_type);
  }

  if (assignment_id) q = q.eq("assignment_id", assignment_id);

  const res = await q;
  if (res.error) {
    return NextResponse.json({ ok: false, error: "log_fetch_failed", details: res.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, rows: res.data ?? [] }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const pc_org_id = String(body.pc_org_id ?? "");
  const shift_date = String(body.shift_date ?? "");
  const assignment_id = String(body.assignment_id ?? "");
  const event_type = String(body.event_type ?? "");
  const message = String(body.message ?? "").trim();

  if (!pc_org_id) return NextResponse.json({ ok: false, error: "missing_pc_org_id" }, { status: 400 });
  if (!shift_date || !isISODate(shift_date))
    return NextResponse.json({ ok: false, error: "invalid_shift_date" }, { status: 400 });
  if (!assignment_id) return NextResponse.json({ ok: false, error: "missing_assignment_id" }, { status: 400 });
  if (!EVENT_TYPES.includes(event_type as EventType))
    return NextResponse.json({ ok: false, error: "invalid_event_type" }, { status: 400 });
  if (!message) return NextResponse.json({ ok: false, error: "missing_message" }, { status: 400 });

  const gate = await requireDispatchAccess(pc_org_id);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const user = gate.user!;
  const admin = supabaseAdmin();

  // Identity stamping: prefer dispatch_day_tech for the day (fast & stable)
  // Fallback to route_lock_roster_tech_v if dispatch_day_tech doesn't have it (e.g., Add before seed).
  const day = await admin
    .from("dispatch_day_tech")
    .select("person_id,tech_id,affiliation_id")
    .eq("pc_org_id", pc_org_id)
    .eq("shift_date", shift_date)
    .eq("assignment_id", assignment_id)
    .maybeSingle();

  let person_id: string | null = day.data?.person_id ?? null;
  let tech_id: string | null = day.data?.tech_id ?? null;
  let affiliation_id: string | null = day.data?.affiliation_id ?? null;

  if (!person_id || !tech_id) {
    const roster = await admin
      .from("route_lock_roster_tech_v")
      .select("person_id,tech_id")
      .eq("pc_org_id", pc_org_id)
      .eq("assignment_id", assignment_id)
      .maybeSingle();

    if (roster.error) {
      return NextResponse.json({ ok: false, error: "roster_lookup_failed", details: roster.error }, { status: 400 });
    }

    person_id = person_id ?? roster.data?.person_id ?? null;
    tech_id = tech_id ?? (roster.data?.tech_id ? String(roster.data.tech_id) : null);
  }

  if (!person_id || !tech_id) {
    return NextResponse.json(
      { ok: false, error: "identity_unresolved", details: "Could not resolve person_id/tech_id for assignment_id" },
      { status: 400 }
    );
  }

  const capDelta = deltaForEventType(event_type as EventType);

  const ins = await admin
    .from("dispatch_console_log")
    .insert({
      pc_org_id,
      shift_date,
      assignment_id,
      person_id,
      tech_id,
      affiliation_id,
      event_type,
      capacity_delta_routes: capDelta,
      message,
      created_by_user_id: user.id,
    })
    .select(
      "dispatch_console_log_id,pc_org_id,shift_date,assignment_id,person_id,tech_id,affiliation_id,event_type,capacity_delta_routes,message,tags,meta,created_at,created_by_user_id"
    )
    .single();

  if (ins.error) {
    return NextResponse.json({ ok: false, error: "log_insert_failed", details: ins.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, row: ins.data }, { status: 200 });
}