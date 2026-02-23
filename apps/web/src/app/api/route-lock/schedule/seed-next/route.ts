import { NextResponse } from "next/server";

import { supabaseServer } from "@/shared/data/supabase/server";
import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";
import { requireSelectedPcOrgServer } from "@/shared/lib/auth/requireSelectedPcOrg.server";

// NOTE:
// This endpoint is intentionally simple and explicit: it only copies
// schedule_baseline_month rows from one fiscal month into another.
// Your “next month stays empty until seeded” requirement is enforced in UI.
// This endpoint is the manual trigger you expected.

type Body = {
  from_fiscal_month_id: string;
  to_fiscal_month_id: string;
};

export async function POST(req: Request) {
  try {
    const scope = await requireSelectedPcOrgServer();
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: "No org selected." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    const fromId = String(body?.from_fiscal_month_id ?? "");
    const toId = String(body?.to_fiscal_month_id ?? "");

    if (!fromId || !toId) {
      return NextResponse.json(
        { ok: false, error: "Missing from_fiscal_month_id or to_fiscal_month_id." },
        { status: 400 }
      );
    }
    if (fromId === toId) {
      return NextResponse.json({ ok: false, error: "from and to fiscal month cannot match." }, { status: 400 });
    }

    const sb = await supabaseServer();
    const pc_org_id = scope.selected_pc_org_id;

    // Source rows (current)
    const { data: srcRows, error: srcErr } = await sb
      .from("schedule_baseline_month")
      .select(
        [
          "pc_org_id",
          "tech_id",
          "assignment_id",
          "default_route_id",
          "sun",
          "mon",
          "tue",
          "wed",
          "thu",
          "fri",
          "sat",
          "sch_hours_sun",
          "sch_hours_mon",
          "sch_hours_tue",
          "sch_hours_wed",
          "sch_hours_thu",
          "sch_hours_fri",
          "sch_hours_sat",
          "sch_units_sun",
          "sch_units_mon",
          "sch_units_tue",
          "sch_units_wed",
          "sch_units_thu",
          "sch_units_fri",
          "sch_units_sat",
        ].join(",")
      )
      .eq("pc_org_id", pc_org_id)
      .eq("fiscal_month_id", fromId)
      .eq("is_active", true);

    if (srcErr) {
      return NextResponse.json({ ok: false, error: srcErr.message }, { status: 500 });
    }

    const src = srcRows ?? [];
    if (!src.length) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        updated: 0,
        note: "No source baselines found to seed from.",
      });
    }

    // Existing rows (next) keyed by assignment_id (preferred) else tech_id
    const { data: existingRows, error: existErr } = await sb
      .from("schedule_baseline_month")
      .select("schedule_baseline_month_id,assignment_id,tech_id")
      .eq("pc_org_id", pc_org_id)
      .eq("fiscal_month_id", toId)
      .eq("is_active", true);

    if (existErr) {
      return NextResponse.json({ ok: false, error: existErr.message }, { status: 500 });
    }

    const existingByKey = new Map<string, string>(); // key -> schedule_baseline_month_id
    for (const r of existingRows ?? []) {
      const k = r.assignment_id ? `A:${r.assignment_id}` : `T:${r.tech_id}`;
      existingByKey.set(k, String(r.schedule_baseline_month_id));
    }

    const seededAt = new Date().toISOString();
    const rowsToUpsert = src.map((r: any) => {
      const assignment_id = r.assignment_id ? String(r.assignment_id) : null;
      const tech_id = String(r.tech_id ?? "");
      const key = assignment_id ? `A:${assignment_id}` : `T:${tech_id}`;
      const existingId = existingByKey.get(key);

      return {
        // if present, this makes it an UPDATE; otherwise an INSERT
        ...(existingId ? { schedule_baseline_month_id: existingId } : {}),

        pc_org_id,
        fiscal_month_id: toId,

        tech_id,
        assignment_id,
        default_route_id: r.default_route_id ?? null,

        sun: r.sun ?? false,
        mon: r.mon ?? false,
        tue: r.tue ?? false,
        wed: r.wed ?? false,
        thu: r.thu ?? false,
        fri: r.fri ?? false,
        sat: r.sat ?? false,

        sch_hours_sun: r.sch_hours_sun ?? 0,
        sch_hours_mon: r.sch_hours_mon ?? 0,
        sch_hours_tue: r.sch_hours_tue ?? 0,
        sch_hours_wed: r.sch_hours_wed ?? 0,
        sch_hours_thu: r.sch_hours_thu ?? 0,
        sch_hours_fri: r.sch_hours_fri ?? 0,
        sch_hours_sat: r.sch_hours_sat ?? 0,

        sch_units_sun: r.sch_units_sun ?? 0,
        sch_units_mon: r.sch_units_mon ?? 0,
        sch_units_tue: r.sch_units_tue ?? 0,
        sch_units_wed: r.sch_units_wed ?? 0,
        sch_units_thu: r.sch_units_thu ?? 0,
        sch_units_fri: r.sch_units_fri ?? 0,
        sch_units_sat: r.sch_units_sat ?? 0,

        is_active: true,
        seeded_from_fiscal_month_id: fromId,
        seeded_at: seededAt,
        updated_at: seededAt,
      };
    });

    const inserted = rowsToUpsert.filter((r) => !("schedule_baseline_month_id" in r)).length;
    const updated = rowsToUpsert.length - inserted;

    // Upsert by primary key if provided (schedule_baseline_month_id), otherwise insert
    // This avoids guessing your unique constraint columns.
    const { error: upErr } = await sb.from("schedule_baseline_month").upsert(rowsToUpsert as any);

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      seeded_at: seededAt,
      today_ny: todayInNY(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "Seed failed") }, { status: 500 });
  }
}