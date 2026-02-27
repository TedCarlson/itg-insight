import { NextResponse, type NextRequest } from "next/server";
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
  return 0; // BP_LOW / INCIDENT / NOTE / TECH_MOVE
}

async function requireDispatchAccess(_pc_org_id: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user) {
    return { ok: false as const, status: 401 as const, error: "unauthorized" as const, user: null };
  }

  const can = await sb.schema("api").rpc("can_access_dispatch", { p_auth_user_id: user.id });

  if (can.error) {
    return { ok: false as const, status: 500 as const, error: "permission_check_failed" as const, user: null };
  }

  if (!can.data) {
    return { ok: false as const, status: 403 as const, error: "forbidden" as const, user: null };
  }

  return { ok: true as const, status: 200 as const, error: null, user };
}

// ✅ NO created_by_display_name here (we synthesize created_by_name below)
const SELECT_COLS =
  "dispatch_console_log_id,pc_org_id,shift_date,assignment_id,person_id,tech_id,affiliation_id,event_type,capacity_delta_routes,message,tags,meta,created_at,created_by_user_id";

async function resolveUserLabels(admin: ReturnType<typeof supabaseAdmin>, userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const out = new Map<string, string>();

  for (const uid of ids) {
    // 1) Prefer user_profile -> person full_name
    try {
      const { data: prof } = await admin.from("user_profile").select("person_id").eq("auth_user_id", uid).maybeSingle();
      const personId = prof?.person_id ? String(prof.person_id) : null;

      if (personId) {
        const { data: person } = await admin.from("person").select("full_name").eq("person_id", personId).maybeSingle();
        const nm = person?.full_name ? String(person.full_name).trim() : "";
        if (nm) {
          out.set(uid, nm);
          continue;
        }
      }
    } catch {
      // ignore, fallback below
    }

    // 2) Fallback to auth email
    try {
      const { data, error } = await admin.auth.admin.getUserById(uid);
      if (!error) {
        const email = (data?.user?.email ?? null) as string | null;
        if (email) {
          out.set(uid, email);
          continue;
        }
      }
    } catch {
      // ignore
    }

    // 3) Fallback to uid
    out.set(uid, uid);
  }

  return out;
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
    .select(SELECT_COLS)
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

  const rows = (res.data ?? []) as any[];
  const nameMap = await resolveUserLabels(admin, rows.map((r) => String(r.created_by_user_id ?? "")));

  const decorated = rows.map((r) => ({
    ...r,
    created_by_name: nameMap.get(String(r.created_by_user_id ?? "")) ?? null,
  }));

  return NextResponse.json({ ok: true, rows: decorated }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const pc_org_id = String((body as any).pc_org_id ?? "");
  const shift_date = String((body as any).shift_date ?? "");
  const assignment_id_raw = (body as any).assignment_id;
  const assignment_id = assignment_id_raw === null || assignment_id_raw === undefined ? "" : String(assignment_id_raw);
  const event_type = String((body as any).event_type ?? "");
  const message = String((body as any).message ?? "").trim();

  if (!pc_org_id) return NextResponse.json({ ok: false, error: "missing_pc_org_id" }, { status: 400 });
  if (!shift_date || !isISODate(shift_date))
    return NextResponse.json({ ok: false, error: "invalid_shift_date" }, { status: 400 });
  if (!EVENT_TYPES.includes(event_type as EventType))
    return NextResponse.json({ ok: false, error: "invalid_event_type" }, { status: 400 });
  if (!message) return NextResponse.json({ ok: false, error: "missing_message" }, { status: 400 });

  const gate = await requireDispatchAccess(pc_org_id);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const user = gate.user!;
  const admin = supabaseAdmin();

  // NOTE is day-level only (assignment_id must be null)
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
        created_by_user_id: user.id,
      })
      .select(SELECT_COLS)
      .single();

    if (ins.error) {
      return NextResponse.json({ ok: false, error: "log_insert_failed", details: ins.error }, { status: 400 });
    }

    const nameMap = await resolveUserLabels(admin, [String(ins.data?.created_by_user_id ?? "")]);
    return NextResponse.json(
      { ok: true, row: { ...ins.data, created_by_name: nameMap.get(String(ins.data?.created_by_user_id ?? "")) ?? null } },
      { status: 200 }
    );
  }

  if (!assignment_id) return NextResponse.json({ ok: false, error: "missing_assignment_id" }, { status: 400 });

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
    .select(SELECT_COLS)
    .single();

  if (ins.error) {
    return NextResponse.json({ ok: false, error: "log_insert_failed", details: ins.error }, { status: 400 });
  }

  const nameMap = await resolveUserLabels(admin, [String(ins.data?.created_by_user_id ?? "")]);
  return NextResponse.json(
    { ok: true, row: { ...ins.data, created_by_name: nameMap.get(String(ins.data?.created_by_user_id ?? "")) ?? null } },
    { status: 200 }
  );
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const dispatch_console_log_id = String((body as any).dispatch_console_log_id ?? "").trim();
  const pc_org_id = String((body as any).pc_org_id ?? "").trim();
  const event_type = String((body as any).event_type ?? "").trim();
  const message = String((body as any).message ?? "").trim();

  if (!dispatch_console_log_id) {
    return NextResponse.json({ ok: false, error: "missing_dispatch_console_log_id" }, { status: 400 });
  }
  if (!pc_org_id) {
    return NextResponse.json({ ok: false, error: "missing_pc_org_id" }, { status: 400 });
  }
  if (!EVENT_TYPES.includes(event_type as EventType)) {
    return NextResponse.json({ ok: false, error: "invalid_event_type" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ ok: false, error: "missing_message" }, { status: 400 });
  }

  const gate = await requireDispatchAccess(pc_org_id);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const user = gate.user!;
  const admin = supabaseAdmin();

  // ✅ Use USER-SCOPED client for update so auth.uid() works in trigger + RLS
  const sb = await supabaseServer();

  // Friendly pre-check (also protects UX)
  const pre = await admin
    .from("dispatch_console_log")
    .select("dispatch_console_log_id,created_by_user_id")
    .eq("dispatch_console_log_id", dispatch_console_log_id)
    .maybeSingle();

  if (pre.error) {
    return NextResponse.json({ ok: false, error: "log_lookup_failed", details: pre.error }, { status: 400 });
  }
  if (!pre.data) {
    return NextResponse.json({ ok: false, error: "log_not_found" }, { status: 404 });
  }
  if (String(pre.data.created_by_user_id) !== String(user.id)) {
    return NextResponse.json({ ok: false, error: "edit_forbidden" }, { status: 403 });
  }

  const upd = await sb
    .from("dispatch_console_log")
    .update({ event_type, message })
    .eq("dispatch_console_log_id", dispatch_console_log_id)
    .select(SELECT_COLS)
    .single();

  if (upd.error) {
  console.error("PATCH ERROR:", upd.error);
  return NextResponse.json(
    {
      ok: false,
      error: upd.error.message,
      code: upd.error.code,
      hint: upd.error.hint,
      details: upd.error.details,
    },
    { status: 400 }
  );
}

  const nameMap = await resolveUserLabels(admin, [String(upd.data?.created_by_user_id ?? "")]);
  return NextResponse.json(
    { ok: true, row: { ...upd.data, created_by_name: nameMap.get(String(upd.data?.created_by_user_id ?? "")) ?? null } },
    { status: 200 }
  );
}