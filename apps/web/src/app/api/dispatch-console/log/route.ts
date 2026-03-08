import { NextResponse, type NextRequest } from "next/server";

import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { requireModule } from "@/shared/access/access";

import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type EventType = "CALL_OUT" | "ADD_IN" | "BP_LOW" | "INCIDENT" | "NOTE" | "TECH_MOVE";
const EVENT_TYPES: EventType[] = ["CALL_OUT", "ADD_IN", "BP_LOW", "INCIDENT", "NOTE", "TECH_MOVE"];

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function deltaForEventType(t: EventType): number {
  if (t === "CALL_OUT") return -1;
  if (t === "ADD_IN") return 1;
  return 0;
}

const SELECT_COLS =
  "dispatch_console_log_id,pc_org_id,shift_date,assignment_id,person_id,tech_id,affiliation_id,event_type,capacity_delta_routes,message,tags,meta,created_at,created_by_user_id,dedupe_key,event_group_id,updated_at,updated_by_user_id";

async function resolveUserLabels(admin: ReturnType<typeof supabaseAdmin>, userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const out = new Map<string, string>();

  for (const uid of ids) {
    try {
      const { data: prof } = await admin
        .from("user_profile")
        .select("person_id")
        .eq("auth_user_id", uid)
        .maybeSingle();

      const personId = prof?.person_id ? String(prof.person_id) : null;

      if (personId) {
        const { data: person } = await admin.from("person").select("full_name").eq("person_id", personId).maybeSingle();
        const nm = person?.full_name ? String(person.full_name).trim() : "";
        if (nm) {
          out.set(uid, nm);
          continue;
        }
      }
    } catch {}

    try {
      const { data, error } = await admin.auth.admin.getUserById(uid);
      if (!error) {
        const email = (data?.user?.email ?? null) as string | null;
        if (email) {
          out.set(uid, email);
          continue;
        }
      }
    } catch {}

    out.set(uid, uid);
  }

  return out;
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
    const event_type = req.nextUrl.searchParams.get("event_type") ?? "";
    const assignment_id = req.nextUrl.searchParams.get("assignment_id") ?? "";

    if (!pc_org_id) return jsonError(400, { ok: false, error: "missing_pc_org_id" });
    if (!shift_date || !isISODate(shift_date)) return jsonError(400, { ok: false, error: "invalid_shift_date" });

    const pass = await requireAccessPass(req, pc_org_id);
    requireModule(pass, "dispatch_console");

    const admin = supabaseAdmin();

    let q = admin
      .from("dispatch_console_log")
      .select(SELECT_COLS)
      .eq("pc_org_id", pc_org_id)
      .eq("shift_date", shift_date)
      .order("created_at", { ascending: false });

    if (event_type) {
      if (!EVENT_TYPES.includes(event_type as EventType)) {
        return jsonError(400, { ok: false, error: "invalid_event_type" });
      }
      q = q.eq("event_type", event_type);
    }

    if (assignment_id) q = q.eq("assignment_id", assignment_id);

    const res = await q;
    if (res.error) return jsonError(400, { ok: false, error: "log_fetch_failed", supabase: res.error });

    const rows = (res.data ?? []) as any[];
    const nameMap = await resolveUserLabels(admin, rows.map((r) => String(r.created_by_user_id ?? "")));

    return NextResponse.json(
      {
        ok: true,
        rows: rows.map((r) => ({
          ...r,
          created_by_name: nameMap.get(String(r.created_by_user_id ?? "")) ?? null,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    return asAccessError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, { ok: false, error: "invalid_json" });

    const pc_org_id = String((body as any).pc_org_id ?? "");
    const pass = await requireAccessPass(req, pc_org_id);
    requireModule(pass, "dispatch_console");

    const userId = pass.auth_user_id;

    const shift_date = String((body as any).shift_date ?? "");
    const assignment_id_raw = (body as any).assignment_id;
    const assignment_id = assignment_id_raw === null || assignment_id_raw === undefined ? "" : String(assignment_id_raw);
    const event_type = String((body as any).event_type ?? "");
    const message = String((body as any).message ?? "").trim();
    const tags = (body as any).tags ?? null;
    const meta = (body as any).meta ?? null;
    const dedupe_key = (body as any).dedupe_key ?? null;
    const event_group_id = (body as any).event_group_id ?? null;

    if (!pc_org_id) return jsonError(400, { ok: false, error: "missing_pc_org_id" });
    if (!shift_date || !isISODate(shift_date)) return jsonError(400, { ok: false, error: "invalid_shift_date" });
    if (!EVENT_TYPES.includes(event_type as EventType)) return jsonError(400, { ok: false, error: "invalid_event_type" });
    if (!message) return jsonError(400, { ok: false, error: "missing_message" });

    const admin = supabaseAdmin();

    if (event_type === "NOTE") {
      const ins = await admin
        .from("dispatch_console_log")
        .insert({
          pc_org_id,
          shift_date,
          assignment_id: null,
          person_id: null,
          tech_id: null,
          affiliation_id: null,
          event_type,
          capacity_delta_routes: 0,
          message,
          tags,
          meta,
          dedupe_key,
          event_group_id,
          created_by_user_id: userId,
        })
        .select(SELECT_COLS)
        .single();

      if (ins.error) return jsonError(400, { ok: false, error: "log_insert_failed", supabase: ins.error });

      const nameMap = await resolveUserLabels(admin, [String(ins.data?.created_by_user_id ?? "")]);

      return NextResponse.json(
        { ok: true, row: { ...ins.data, created_by_name: nameMap.get(String(ins.data?.created_by_user_id ?? "")) ?? null } },
        { status: 200 }
      );
    }

    if (!assignment_id) return jsonError(400, { ok: false, error: "missing_assignment_id" });

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

      if (roster.error) return jsonError(400, { ok: false, error: "roster_lookup_failed", supabase: roster.error });

      person_id = person_id ?? roster.data?.person_id ?? null;
      tech_id = tech_id ?? (roster.data?.tech_id ? String(roster.data.tech_id) : null);
    }

    if (!person_id || !tech_id) return jsonError(400, { ok: false, error: "identity_unresolved" });

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
        capacity_delta_routes: deltaForEventType(event_type as EventType),
        message,
        tags,
        meta,
        dedupe_key,
        event_group_id,
        created_by_user_id: userId,
      })
      .select(SELECT_COLS)
      .single();

    if (ins.error) return jsonError(400, { ok: false, error: "log_insert_failed", supabase: ins.error });

    const nameMap = await resolveUserLabels(admin, [String(ins.data?.created_by_user_id ?? "")]);

    return NextResponse.json(
      { ok: true, row: { ...ins.data, created_by_name: nameMap.get(String(ins.data?.created_by_user_id ?? "")) ?? null } },
      { status: 200 }
    );
  } catch (err) {
    return asAccessError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, { ok: false, error: "invalid_json" });

    const pc_org_id = String((body as any).pc_org_id ?? "").trim();
    const pass = await requireAccessPass(req, pc_org_id);
    requireModule(pass, "dispatch_console");

    const userId = pass.auth_user_id;

    const dispatch_console_log_id = String((body as any).dispatch_console_log_id ?? "").trim();
    const event_type = String((body as any).event_type ?? "").trim();
    const message = String((body as any).message ?? "").trim();

    if (!dispatch_console_log_id) return jsonError(400, { ok: false, error: "missing_dispatch_console_log_id" });
    if (!pc_org_id) return jsonError(400, { ok: false, error: "missing_pc_org_id" });
    if (!EVENT_TYPES.includes(event_type as EventType)) return jsonError(400, { ok: false, error: "invalid_event_type" });
    if (!message) return jsonError(400, { ok: false, error: "missing_message" });

    const admin = supabaseAdmin();

    const pre = await admin
      .from("dispatch_console_log")
      .select("dispatch_console_log_id,pc_org_id,created_by_user_id")
      .eq("dispatch_console_log_id", dispatch_console_log_id)
      .maybeSingle();

    if (pre.error) return jsonError(400, { ok: false, error: "log_lookup_failed", supabase: pre.error });
    if (!pre.data) return jsonError(404, { ok: false, error: "log_not_found" });
    if (String(pre.data.pc_org_id) !== String(pc_org_id)) return jsonError(400, { ok: false, error: "pc_org_mismatch" });
    if (String(pre.data.created_by_user_id) !== String(userId)) return jsonError(403, { ok: false, error: "edit_forbidden" });

    const sb = await supabaseServer();

    const upd = await sb
      .from("dispatch_console_log")
      .update({ event_type, message })
      .eq("dispatch_console_log_id", dispatch_console_log_id)
      .select(SELECT_COLS)
      .single();

    if (upd.error) return jsonError(400, { ok: false, error: "log_update_failed", supabase: upd.error });

    const nameMap = await resolveUserLabels(admin, [String(upd.data?.created_by_user_id ?? "")]);

    return NextResponse.json(
      { ok: true, row: { ...upd.data, created_by_name: nameMap.get(String(upd.data?.created_by_user_id ?? "")) ?? null } },
      { status: 200 }
    );
  } catch (err) {
    return asAccessError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const pc_org_id_qs = req.nextUrl.searchParams.get("pc_org_id") ?? "";
    const id_qs = req.nextUrl.searchParams.get("dispatch_console_log_id") ?? "";

    const body = await req.json().catch(() => null);

    const pc_org_id = String((body as any)?.pc_org_id ?? pc_org_id_qs ?? "").trim();
    const dispatch_console_log_id = String((body as any)?.dispatch_console_log_id ?? id_qs ?? "").trim();

    const pass = await requireAccessPass(req, pc_org_id);
    requireModule(pass, "dispatch_console");

    const userId = pass.auth_user_id;

    if (!dispatch_console_log_id) return jsonError(400, { ok: false, error: "missing_dispatch_console_log_id" });
    if (!pc_org_id) return jsonError(400, { ok: false, error: "missing_pc_org_id" });

    const admin = supabaseAdmin();

    const pre = await admin
      .from("dispatch_console_log")
      .select("dispatch_console_log_id,pc_org_id,created_by_user_id")
      .eq("dispatch_console_log_id", dispatch_console_log_id)
      .maybeSingle();

    if (pre.error) return jsonError(400, { ok: false, error: "log_lookup_failed", supabase: pre.error });
    if (!pre.data) return jsonError(404, { ok: false, error: "log_not_found" });
    if (String(pre.data.pc_org_id) !== String(pc_org_id)) return jsonError(400, { ok: false, error: "pc_org_mismatch" });
    if (String(pre.data.created_by_user_id) !== String(userId)) return jsonError(403, { ok: false, error: "delete_forbidden" });

    const sb = await supabaseServer();

    const del = await sb.from("dispatch_console_log").delete().eq("dispatch_console_log_id", dispatch_console_log_id);

    if (del.error) return jsonError(400, { ok: false, error: "delete_failed", supabase: del.error });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return asAccessError(err);
  }
}