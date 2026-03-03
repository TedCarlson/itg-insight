import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function jsonError(status: number, error: string, details?: any) {
  return NextResponse.json({ ok: false, error, ...(details ? { details } : {}) }, { status });
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

type EntryType = "CALL_OUT" | "ADD_IN" | "BP_LOW" | "INCIDENT" | "TECH_MOVE" | "NOTE";

async function safeJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * HISTORY (GET)
 * Supports:
 * - pc_org_id (required)
 * - shift_date (required, YYYY-MM-DD)
 * - assignment_id (optional)
 * - event_type (optional; "ALL" or omitted means no filter)
 */
export async function GET(req: NextRequest) {
  const pc_org_id = req.nextUrl.searchParams.get("pc_org_id") ?? "";
  const shift_date = req.nextUrl.searchParams.get("shift_date") ?? "";
  const assignment_id = asStr(req.nextUrl.searchParams.get("assignment_id")) || "";
  const event_type_raw = asStr(req.nextUrl.searchParams.get("event_type")) || "";

  if (!pc_org_id) return jsonError(400, "missing_pc_org_id");
  if (!shift_date || !isISODate(shift_date)) return jsonError(400, "invalid_shift_date");

  const gate = await requireDispatchAccess(pc_org_id);
  if (!gate.ok) return jsonError(gate.status, gate.error);

  const admin = supabaseAdmin();

  // Prefer view if you have it; if not, change to "dispatch_console_log"
  // View is useful because it can carry extra display fields without breaking UI.
  let q = admin
    .from("dispatch_console_log_v")
    .select("*")
    .eq("pc_org_id", pc_org_id)
    .eq("shift_date", shift_date);

  if (assignment_id) q = q.eq("assignment_id", assignment_id);

  // Allow callers to pass "ALL" (common UI pattern) or omit entirely.
  if (event_type_raw && event_type_raw !== "ALL") q = q.eq("event_type", event_type_raw);

  // newest first
  q = q.order("created_at", { ascending: false });

  const rowsRes = await q;

  if (rowsRes.error) {
    // If your view name differs / doesn't exist, you'll see it here.
    return jsonError(400, "history_fetch_failed", rowsRes.error);
  }

  return NextResponse.json({ ok: true, rows: rowsRes.data ?? [] }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  if (!body) return jsonError(400, "invalid_json");

  const pc_org_id = asStr(body.pc_org_id);
  const shift_date = asStr(body.shift_date);
  const assignment_id = asStr(body.assignment_id) || null;
  const event_type = asStr(body.event_type) as EntryType;
  const message = asStr(body.message);

  if (!pc_org_id) return jsonError(400, "missing_pc_org_id");
  if (!shift_date || !isISODate(shift_date)) return jsonError(400, "invalid_shift_date");
  if (!event_type) return jsonError(400, "missing_event_type");
  if (!message) return jsonError(400, "missing_message");

  // NOTE can be org-level (null assignment) OR assignment-tied.
  // Non-NOTE requires assignment.
  if (event_type !== "NOTE" && !assignment_id) return jsonError(400, "missing_assignment_id");

  const gate = await requireDispatchAccess(pc_org_id);
  if (!gate.ok) return jsonError(gate.status, gate.error);

  const admin = supabaseAdmin();

  const ins = await admin
    .from("dispatch_console_log")
    .insert({
      pc_org_id,
      shift_date,
      assignment_id,
      event_type,
      message,
      created_by_user_id: gate.user!.id,
    })
    .select("dispatch_console_log_id")
    .single();

  if (ins.error) return jsonError(400, "insert_failed", ins.error);

  return NextResponse.json({ ok: true, dispatch_console_log_id: ins.data.dispatch_console_log_id }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const body = await safeJson(req);
  if (!body) return jsonError(400, "invalid_json");

  const pc_org_id = asStr(body.pc_org_id);
  const dispatch_console_log_id = asStr(body.dispatch_console_log_id);
  const message = asStr(body.message);

  if (!pc_org_id) return jsonError(400, "missing_pc_org_id");
  if (!dispatch_console_log_id) return jsonError(400, "missing_dispatch_console_log_id");
  if (!message) return jsonError(400, "missing_message");

  const gate = await requireDispatchAccess(pc_org_id);
  if (!gate.ok) return jsonError(gate.status, gate.error);

  const admin = supabaseAdmin();

  const cur = await admin
    .from("dispatch_console_log")
    .select("dispatch_console_log_id,pc_org_id,event_type,created_by_user_id")
    .eq("dispatch_console_log_id", dispatch_console_log_id)
    .maybeSingle();

  if (cur.error) return jsonError(400, "fetch_failed", cur.error);
  if (!cur.data) return jsonError(404, "not_found");

  if (String(cur.data.pc_org_id) !== pc_org_id) return jsonError(403, "forbidden");
  if (String(cur.data.created_by_user_id) !== String(gate.user!.id)) return jsonError(403, "not_creator");

  // Guardrail: edits are NOTE-only + message-only
  if (cur.data.event_type !== "NOTE") return jsonError(409, "edit_not_allowed_for_event_type");

  const upd = await admin
    .from("dispatch_console_log")
    .update({ message })
    .eq("dispatch_console_log_id", dispatch_console_log_id)
    .select("dispatch_console_log_id")
    .single();

  if (upd.error) return jsonError(400, "update_failed", upd.error);

  return NextResponse.json({ ok: true, dispatch_console_log_id: upd.data.dispatch_console_log_id }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const body = await safeJson(req);
  if (!body) return jsonError(400, "invalid_json");

  const pc_org_id = asStr(body.pc_org_id);
  const dispatch_console_log_id = asStr(body.dispatch_console_log_id);

  if (!pc_org_id) return jsonError(400, "missing_pc_org_id");
  if (!dispatch_console_log_id) return jsonError(400, "missing_dispatch_console_log_id");

  const gate = await requireDispatchAccess(pc_org_id);
  if (!gate.ok) return jsonError(gate.status, gate.error);

  const admin = supabaseAdmin();

  const cur = await admin
    .from("dispatch_console_log")
    .select("dispatch_console_log_id,pc_org_id,event_type,created_by_user_id")
    .eq("dispatch_console_log_id", dispatch_console_log_id)
    .maybeSingle();

  if (cur.error) return jsonError(400, "fetch_failed", cur.error);
  if (!cur.data) return jsonError(404, "not_found");

  if (String(cur.data.pc_org_id) !== pc_org_id) return jsonError(403, "forbidden");
  if (String(cur.data.created_by_user_id) !== String(gate.user!.id)) return jsonError(403, "not_creator");

  // Guardrail: deletes are NOTE-only
  if (cur.data.event_type !== "NOTE") return jsonError(409, "delete_not_allowed_for_event_type");

  const del = await admin.from("dispatch_console_log").delete().eq("dispatch_console_log_id", dispatch_console_log_id);

  if (del.error) return jsonError(400, "delete_failed", del.error);

  return NextResponse.json({ ok: true }, { status: 200 });
}