// path: apps/web/src/app/api/bp-owner/tech-history/tech/route.ts

import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { resolveBpOwnerScope } from "@/features/role-bp-owner/lib/resolveBpOwnerScope.server";

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

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function weekdayKey(dateOnly: string): DayKey {
  const d = new Date(`${dateOnly}T00:00:00`);
  return DAY_KEYS[d.getDay()]!;
}

function daySetLabel(keys: DayKey[]) {
  return keys.map((k) => DAY_LABELS[k]).join(" ");
}

async function requireBpOwnerAssignment(assignmentId: string) {
  const scope = await resolveBpOwnerScope();

  const allowedAssignmentIds = new Set(
    scope.scoped_assignments
      .map((row) => clean(row.assignment_id))
      .filter(Boolean),
  );

  if (!allowedAssignmentIds.has(assignmentId)) {
    return {
      ok: false as const,
      status: 403,
      error: "forbidden",
    };
  }

  const matched = scope.scoped_assignments.find(
    (row) => clean(row.assignment_id) === assignmentId,
  );

  return {
    ok: true as const,
    pcOrgId: clean(matched?.pc_org_id),
  };
}

export async function GET(req: NextRequest) {
  const assignment_id = asUuid(req.nextUrl.searchParams.get("assignment_id"));
  const from = asDateOnly(req.nextUrl.searchParams.get("from"));
  const to = asDateOnly(req.nextUrl.searchParams.get("to"));

  if (!assignment_id || !from || !to) {
    return NextResponse.json(
      { ok: false, error: "Invalid parameters" },
      { status: 400 },
    );
  }

  const guard = await requireBpOwnerAssignment(assignment_id);

  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status },
    );
  }

  const admin = supabaseAdmin();

  const { data: techRow } = await admin
    .from("route_lock_roster_v")
    .select("assignment_id,tech_id,full_name,co_name")
    .eq("assignment_id", assignment_id)
    .maybeSingle();

  if (!techRow) {
    return NextResponse.json(
      { ok: false, error: "Technician not found" },
      { status: 404 },
    );
  }

  const { data: days, error: dayErr } = await admin
    .from("schedule_day_fact")
    .select("shift_date,planned_route_id,plan_source")
    .eq("assignment_id", assignment_id)
    .gte("shift_date", from)
    .lte("shift_date", to)
    .order("shift_date");

  if (dayErr) {
    return NextResponse.json(
      { ok: false, error: dayErr.message },
      { status: 500 },
    );
  }

  const routeIds = Array.from(
    new Set((days ?? []).map((d: any) => d.planned_route_id).filter(Boolean)),
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
    const shiftDate = String(row.shift_date);
    const routeId = row.planned_route_id ? String(row.planned_route_id) : null;
    const routeName = routeId ? routeMap.get(routeId) ?? routeId : null;
    const wk = weekdayKey(shiftDate);

    if (!current) {
      current = {
        from_date: shiftDate,
        to_date: shiftDate,
        route_id: routeId,
        route_name: routeName,
        daySet: new Set<DayKey>([wk]),
        detail_rows: [],
      };
    } else if (current.route_id === routeId) {
      current.to_date = shiftDate;
      current.daySet.add(wk);
    } else {
      segments.push(current);
      current = {
        from_date: shiftDate,
        to_date: shiftDate,
        route_id: routeId,
        route_name: routeName,
        daySet: new Set<DayKey>([wk]),
        detail_rows: [],
      };
    }

    current.detail_rows.push({
      shift_date: shiftDate,
      weekday_key: wk,
      weekday_label: DAY_LABELS[wk],
      route_id: routeId,
      route_name: routeName,
    });
  }

  if (current) {
    segments.push(current);
  }

  const normalizedSegments = segments.map((segment, idx) => {
    const daySet = Array.from(segment.daySet) as DayKey[];

    return {
      segment_id: `${segment.from_date}:${idx}`,
      from_date: segment.from_date,
      to_date: segment.to_date,
      route_id: segment.route_id,
      route_name: segment.route_name,
      baseline_days_count: daySet.length,
      baseline_day_set: daySet,
      baseline_day_set_label: daySetLabel(daySet),
      span_days: segment.detail_rows.length,
      detail_rows: segment.detail_rows,
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
      tech_id: String((techRow as any).tech_id ?? ""),
      full_name: String((techRow as any).full_name ?? ""),
      co_name:
        (techRow as any).co_name == null ? null : String((techRow as any).co_name),
    },
    window: { from, to },
    events,
    segments: normalizedSegments,
  });
}