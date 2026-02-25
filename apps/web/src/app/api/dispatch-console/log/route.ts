// apps/web/src/app/api/dispatch-console/log/route.ts

import { NextResponse } from "next/server";
import { requireSelectedPcOrgServer } from "@/shared/lib/auth/requireSelectedPcOrg.server";
import { requireDispatchConsoleAccess } from "../_auth";

type EventType = "CALL_OUT" | "ADD_IN" | "INCIDENT" | "NOTE";

function deltaFor(t: EventType): number {
  if (t === "CALL_OUT") return -1;
  if (t === "ADD_IN") return 1;
  return 0;
}

function asIsoDate(v: any): string | null {
  const s = String(v ?? "").trim();
  // Minimal validation: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function pickPcOrgId(raw: any, fallback: string | null): string | null {
  const s = String(raw ?? fallback ?? "").trim();
  return s ? s : null;
}

export async function GET(req: Request) {
  try {
    const authz = await requireDispatchConsoleAccess();
    if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });

    const url = new URL(req.url);
    const qPcOrgId = url.searchParams.get("pc_org_id");
    const qShiftDate = url.searchParams.get("shift_date");

    const sel = await requireSelectedPcOrgServer();
    const selectedPcOrgId = sel.ok ? sel.selected_pc_org_id : null;
    const pc_org_id = pickPcOrgId(qPcOrgId, selectedPcOrgId);
    const shift_date = asIsoDate(qShiftDate);

    if (!pc_org_id) {
      return NextResponse.json({ ok: false, error: "Missing pc_org_id (select a PC scope)" }, { status: 400 });
    }
    if (selectedPcOrgId && pc_org_id !== selectedPcOrgId) {
      return NextResponse.json({ ok: false, error: "Forbidden (org mismatch)" }, { status: 403 });
    }
    if (!shift_date) {
      return NextResponse.json({ ok: false, error: "Missing/invalid shift_date (YYYY-MM-DD)" }, { status: 400 });
    }

    const { data, error } = await authz.supabase
      .from("dispatch_console_log")
      .select("*")
      .eq("pc_org_id", pc_org_id)
      .eq("shift_date", shift_date)
      .order("created_at", { ascending: true });

    if (error) {
      // Common during rollout (table not created yet)
      const msg = error.message ?? "Query failed";
      const missing = msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation");
      return NextResponse.json(
        { ok: false, error: missing ? "Dispatch Console DB shape not deployed yet" : msg },
        { status: missing ? 501 : 400 }
      );
    }

    return NextResponse.json({ ok: true, rows: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authz = await requireDispatchConsoleAccess();
    if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });

    const body = await req.json().catch(() => ({}));
    const qPcOrgId = body?.pc_org_id ?? null;
    const qShiftDate = body?.shift_date ?? null;
    const assignment_id = String(body?.assignment_id ?? "").trim();
    const event_type = String(body?.event_type ?? "").trim() as EventType;
    const message = String(body?.message ?? "").trim();

    const sel = await requireSelectedPcOrgServer();
    const selectedPcOrgId = sel.ok ? sel.selected_pc_org_id : null;
    const pc_org_id = pickPcOrgId(qPcOrgId, selectedPcOrgId);
    const shift_date = asIsoDate(qShiftDate);

    if (!pc_org_id) {
      return NextResponse.json({ ok: false, error: "Missing pc_org_id (select a PC scope)" }, { status: 400 });
    }
    if (selectedPcOrgId && pc_org_id !== selectedPcOrgId) {
      return NextResponse.json({ ok: false, error: "Forbidden (org mismatch)" }, { status: 403 });
    }
    if (!shift_date) {
      return NextResponse.json({ ok: false, error: "Missing/invalid shift_date (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!assignment_id) {
      return NextResponse.json({ ok: false, error: "Missing assignment_id" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });
    }
    if (!(["CALL_OUT", "ADD_IN", "INCIDENT", "NOTE"] as string[]).includes(event_type)) {
      return NextResponse.json({ ok: false, error: "Invalid event_type" }, { status: 400 });
    }

    // Resolve/stamp denormalized fields from the roster view.
    const { data: rosterRow, error: rosterErr } = await authz.supabase
      .from("route_lock_roster_tech_v")
      .select("*")
      .eq("pc_org_id", pc_org_id)
      .eq("assignment_id", assignment_id)
      .maybeSingle();

    if (rosterErr) {
      return NextResponse.json({ ok: false, error: rosterErr.message }, { status: 400 });
    }
    if (!rosterRow) {
      return NextResponse.json({ ok: false, error: "Unknown assignment_id for this PC scope" }, { status: 404 });
    }

    const person_id = String((rosterRow as any).person_id ?? "").trim();
    const tech_id = String((rosterRow as any).tech_id ?? "").trim();
    const affiliation_id = (rosterRow as any).affiliation_id ?? null;

    if (!person_id || !tech_id) {
      return NextResponse.json({ ok: false, error: "Roster row missing person_id or tech_id" }, { status: 409 });
    }

    const insPayload: any = {
      pc_org_id,
      shift_date,
      assignment_id,
      person_id,
      tech_id,
      affiliation_id,
      event_type,
      capacity_delta_routes: deltaFor(event_type),
      message,
      created_by_user_id: authz.boot.auth_user_id,
    };

    const { data, error } = await authz.supabase.from("dispatch_console_log").insert(insPayload).select("*").single();

    if (error) {
      const msg = error.message ?? "Insert failed";
      const missing = msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation");
      return NextResponse.json(
        { ok: false, error: missing ? "Dispatch Console DB shape not deployed yet" : msg },
        { status: missing ? 501 : 400 }
      );
    }

    return NextResponse.json({ ok: true, row: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}