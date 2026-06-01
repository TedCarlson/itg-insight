import { NextResponse, type NextRequest } from "next/server";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { requireScheduleExceptionSubmitAccess } from "@/shared/access/scheduleExceptionSubmitAccess";
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

function errorStatus(err: any) {
  const status = Number(err?.status ?? 500);
  if ([400, 401, 403, 409].includes(status)) return status;
  return 500;
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireSelectedPcOrgServer();

    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Body;

    const pc_org_id = String(body.pc_org_id ?? scope.selected_pc_org_id ?? "").trim();
    const selected_pc_org_id = String(scope.selected_pc_org_id ?? "").trim();
    const tech_id = String(body.tech_id ?? "").trim();
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!pc_org_id) {
      return NextResponse.json({ ok: false, error: "pc_org_id_required" }, { status: 400 });
    }

    if (pc_org_id !== selected_pc_org_id) {
      return NextResponse.json({ ok: false, error: "pc_org mismatch" }, { status: 403 });
    }

    const pass = await requireAccessPass(req, pc_org_id);
    requireScheduleExceptionSubmitAccess(pass);

    if (!tech_id) {
      return NextResponse.json({ ok: false, error: "tech_id_required" }, { status: 400 });
    }

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "rows_required" }, { status: 400 });
    }

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
      override_hours: r.override_hours == null ? null : Number(r.override_hours),
      override_units: r.override_units == null ? null : Number(r.override_units),
      notes: r.notes == null || r.notes === "" ? null : String(r.notes),
      approved: false,
      requested_by: scope.boot.auth_user_id,
      approved_by: null,
      decision_notes: null,
      decision_at: null,
      status: "PENDING",
    }));

    const { data, error } = await supabaseAdmin()
      .from("schedule_exception_day")
      .upsert(payload, { onConflict: "pc_org_id,tech_id,shift_date" })
      .select();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? "unknown_error") },
      { status: errorStatus(err) },
    );
  }
}
