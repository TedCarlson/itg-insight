import { NextResponse } from "next/server";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BodyRow = {
  shift_date: string;
  exception_type: string;
  force_off?: boolean | null;

  override_route_id?: string | null;
  override_hours?: number | null;
  override_units?: number | null;

  notes?: string | null;
};

type Body = {
  pc_org_id?: string;
  tech_id?: string;
  rows?: BodyRow[];
};

function asDateOnly(v: unknown) {
  return String(v ?? "").slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const scope = await requireSelectedPcOrgServer();

    if (!scope.ok) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as Body;

    const pc_org_id = String(
      body.pc_org_id ?? scope.selected_pc_org_id ?? ""
    ).trim();

    const tech_id = String(body.tech_id ?? "").trim();

    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!pc_org_id) {
      return NextResponse.json(
        { ok: false, error: "pc_org_id_required" },
        { status: 400 }
      );
    }

    if (!tech_id) {
      return NextResponse.json(
        { ok: false, error: "tech_id_required" },
        { status: 400 }
      );
    }

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "rows_required" },
        { status: 400 }
      );
    }

    const sb = supabaseAdmin();

    const payload = rows.map((r) => ({
      pc_org_id,
      tech_id,

      shift_date: asDateOnly(r.shift_date),

      exception_type: String(r.exception_type ?? "").trim(),

      force_off: !!r.force_off,

      override_route_id:
        r.override_route_id == null || r.override_route_id === ""
          ? null
          : String(r.override_route_id),

      override_hours:
        r.override_hours == null
          ? null
          : Number(r.override_hours),

      override_units:
        r.override_units == null
          ? null
          : Number(r.override_units),

      notes:
        r.notes == null || r.notes === ""
          ? null
          : String(r.notes),

      // IMPORTANT
      approved: false,
      approved_by_user_id: null,
      approved_at: null,

      denied_by_user_id: null,
      denied_at: null,

      decision_notes: null,

      status: "PENDING",
    }));

    const { data, error } = await sb
      .from("schedule_exception_day")
      .upsert(payload, {
        onConflict: "pc_org_id,tech_id,shift_date",
      })
      .select();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      rows: data ?? [],
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message ?? "unknown_error"),
      },
      { status: 500 }
    );
  }
}