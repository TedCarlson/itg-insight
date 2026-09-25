import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { requireModule } from "@/shared/access/access";

export const runtime = "nodejs";

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS: Record<DayKey, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

function asDateOnly(v: unknown) {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function asUuid(v: unknown) {
  const s = String(v ?? "").trim();
  return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
}

function weekdayKey(dateOnly: string): DayKey {
  const d = new Date(`${dateOnly}T00:00:00`);
  return DAY_KEYS[d.getDay()]!;
}

function daySetLabel(keys: DayKey[]) {
  return keys.map((k) => DAY_LABELS[k]).join(" ");
}

async function resolveSelectedPcOrg(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();

  if (!user || error) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }

  const admin = supabaseAdmin();

  const { data: profile } = await admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const pc_org_id = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pc_org_id) {
    return { ok: false as const, status: 409, error: "no selected org" };
  }

  try {
    const pass = await requireAccessPass(req, pc_org_id);
    requireModule(pass, "route_lock");
    return { ok: true as const, pc_org_id };
  } catch {
    return { ok: false as const, status: 403, error: "forbidden" };
  }
}

export async function GET(req: NextRequest) {
  const guard = await resolveSelectedPcOrg(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const assignment_id = asUuid(req.nextUrl.searchParams.get("assignment_id"));
  const from = asDateOnly(req.nextUrl.searchParams.get("from"));
  const to = asDateOnly(req.nextUrl.searchParams.get("to"));

  if (!assignment_id || !from || !to) {
    return NextResponse.json({ ok: false, error: "Invalid parameters" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: techRow } = await admin
    .from("route_lock_history_roster_v")
    .select("assignment_id,tech_id,full_name,co_name")
    .eq("pc_org_id", guard.pc_org_id)
    .eq("assignment_id", assignment_id)
    .maybeSingle();

  if (!techRow) {
    return NextResponse.json({ ok: false, error: "Technician not found" }, { status: 404 });
  }

  const { data: days, error: dayErr } = await admin
    .from("schedule_day_fact")
    .select("shift_date,planned_route_id,plan_source")
    .eq("pc_org_id", guard.pc_org_id)
    .eq("assignment_id", assignment_id)
    .gte("shift_date", from)
    .lte("shift_date", to)
    .order("shift_date");

  if (dayErr) {
    return NextResponse.json({ ok: false, error: dayErr.message }, { status: 500 });
  }

  const routeIds = Array.from(
    new Set((days ?? []).map((d: any) => d.planned_route_id).filter(Boolean))
  );

  const routeMap = new Map<string, string>();

  if (routeIds.length) {
    const { data: routes } = await admin
      .from("route")
      .select("route_id,route_name")
      .in("route_id", routeIds);

    (routes ?? []).forEach((r: any) => {
      routeMap.set(String(r.route_id), String(r.route_name ?? r.route_id));
    });
  }

  const segments: Array<{
    from_date: string;
    to_date: string;
    route_id: string | null;
    route_name: string | null;
    daySet: Set<DayKey>;
    detail_rows: Array<{
      shift_date: string;
      weekday_key: DayKey;
      weekday_label: string;
      route_id: string | null;
      route_name: string | null;
    }>;
  }> = [];

  const rows = (days ?? []) as Array<{
    shift_date: string;
    planned_route_id: string | null;
    plan_source?: string | null;
  }>;

  let current:
    | {
        from_date: string;
        to_date: string;
        route_id: string | null;
        route_name: string | null;
        daySet: Set<DayKey>;
        detail_rows: Array<{
          shift_date: string;
          weekday_key: DayKey;
          weekday_label: string;
          route_id: string | null;
          route_name: string | null;
        }>;
      }
    | null = null;

  for (const row of rows) {
    const shift_date = String(row.shift_date);
    const route_id = row.planned_route_id ? String(row.planned_route_id) : null;
    const route_name = route_id ? routeMap.get(route_id) ?? route_id : null;
    const wk = weekdayKey(shift_date);

    if (!current) {
      current = {
        from_date: shift_date,
        to_date: shift_date,
        route_id,
        route_name,
        daySet: new Set<DayKey>([wk]),
        detail_rows: [],
      };
    } else if (current.route_id === route_id) {
      current.to_date = shift_date;
      current.daySet.add(wk);
    } else {
      segments.push(current);
      current = {
        from_date: shift_date,
        to_date: shift_date,
        route_id,
        route_name,
        daySet: new Set<DayKey>([wk]),
        detail_rows: [],
      };
    }

    current.detail_rows.push({
      shift_date,
      weekday_key: wk,
      weekday_label: DAY_LABELS[wk],
      route_id,
      route_name,
    });
  }

  if (current) segments.push(current);

  const normalizedSegments = segments.map((s, idx) => {
    const daySet = Array.from(s.daySet) as DayKey[];

    return {
      segment_id: `${s.from_date}:${idx}`,
      from_date: s.from_date,
      to_date: s.to_date,
      route_id: s.route_id,
      route_name: s.route_name,
      baseline_days_count: daySet.length,
      baseline_day_set: daySet,
      baseline_day_set_label: daySetLabel(daySet),
      span_days: s.detail_rows.length,
      detail_rows: s.detail_rows,
    };
  });

  const events: any[] = [];

  for (let i = 0; i < normalizedSegments.length; i += 1) {
    const seg = normalizedSegments[i];
    const prev = normalizedSegments[i - 1];

    if (!prev) {
      events.push({
        effective_date: seg.from_date,
        event_type: "INITIAL_ASSIGNMENT",
        to_value: seg.route_name ?? "Unassigned",
      });
      continue;
    }

    if (prev.route_id !== seg.route_id) {
      events.push({
        effective_date: seg.from_date,
        event_type: "ROUTE_CHANGE",
        from_value: prev.route_name ?? "Unassigned",
        to_value: seg.route_name ?? "Unassigned",
      });
    }

    if (prev.baseline_day_set_label !== seg.baseline_day_set_label) {
      events.push({
        effective_date: seg.from_date,
        event_type: "BASELINE_DAYS_CHANGE",
        from_value: prev.baseline_days_count,
        to_value: seg.baseline_days_count,
        from_day_set: prev.baseline_day_set_label,
        to_day_set: seg.baseline_day_set_label,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    tech: {
      assignment_id,
      tech_id: String(techRow.tech_id ?? ""),
      full_name: String(techRow.full_name ?? ""),
      co_name: techRow.co_name == null ? null : String(techRow.co_name),
    },
    window: { from, to },
    events,
    segments: normalizedSegments,
  });
}
