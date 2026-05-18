import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { requireModule } from "@/shared/access/access";

export const runtime = "nodejs";

type DraftRow = {
  shift_date: string;
  exception_type: string;
  force_off: boolean;
  override_route_id?: string | null;
  override_hours?: number | null;
  override_units?: number | null;
  notes?: string | null;
};

type WorkforceMatch = {
  assignment_id: string | null;
  person_id: string | null;
  tech_id: string | null;
  full_name: string | null;
  is_active: boolean | null;
};

function isDateOnly(v: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "").trim());
}

async function resolveSelectedPcOrg(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (!user || userErr) {
    return { ok: false as const, status: 401, error: "unauthorized", user: null };
  }

  const admin = supabaseAdmin();

  const { data: profile, error: profileErr } = await admin
    .from("user_profile")
    .select("selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileErr) {
    return { ok: false as const, status: 500, error: profileErr.message, user: null };
  }

  const pc_org_id = String(profile?.selected_pc_org_id ?? "").trim();
  if (!pc_org_id) {
    return { ok: false as const, status: 409, error: "no selected org", user: null };
  }

  try {
    const pass = await requireAccessPass(req, pc_org_id);
    requireModule(pass, "route_lock");

    return {
      ok: true as const,
      pc_org_id,
      user,
    };
  } catch (err: any) {
    const status = Number(err?.status ?? 500);

    if (status === 401) return { ok: false as const, status: 401, error: "unauthorized", user: null };
    if (status === 403) return { ok: false as const, status: 403, error: "forbidden", user: null };

    if (status === 400) {
      return {
        ok: false as const,
        status: 400,
        error: String(err?.message ?? "invalid_pc_org_id"),
        user: null,
      };
    }

    return { ok: false as const, status: 500, error: "access_error", user: null };
  }
}

export async function POST(req: NextRequest) {
  const guard = await resolveSelectedPcOrg(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => null);

  const bodyPcOrgId = String(body?.pc_org_id ?? "").trim();
  const tech_id = String(body?.tech_id ?? "").trim();
  const person_id = String(body?.person_id ?? "").trim();
  const assignment_id = String(body?.assignment_id ?? "").trim();
  const rows = Array.isArray(body?.rows) ? (body.rows as DraftRow[]) : [];

  if (!bodyPcOrgId || !tech_id || !person_id || !assignment_id || !rows.length) {
    return NextResponse.json({ ok: false, error: "missing required fields" }, { status: 400 });
  }

  if (bodyPcOrgId !== guard.pc_org_id) {
    return NextResponse.json({ ok: false, error: "pc_org mismatch" }, { status: 403 });
  }

  for (const row of rows) {
    if (!isDateOnly(row.shift_date)) {
      return NextResponse.json(
        { ok: false, error: `invalid shift_date: ${row.shift_date}` },
        { status: 400 }
      );
    }
  }

  const admin = supabaseAdmin();

  const { data: baselineRows, error: baselineErr } = await admin
    .from("schedule_baseline_month")
    .select("assignment_id,tech_id,is_active")
    .eq("pc_org_id", guard.pc_org_id)
    .eq("assignment_id", assignment_id)
    .eq("tech_id", tech_id)
    .eq("is_active", true)
    .limit(1);

  if (baselineErr) {
    return NextResponse.json({ ok: false, error: baselineErr.message }, { status: 500 });
  }

  if (!baselineRows?.length) {
    return NextResponse.json(
      { ok: false, error: "technician is not on an active baseline schedule" },
      { status: 400 }
    );
  }

  const { data: workforce, error: workforceErr } = await admin
    .from("workforce_current_v")
    .select("assignment_id,person_id,tech_id,full_name,is_active")
    .eq("pc_org_id", guard.pc_org_id)
    .eq("assignment_id", assignment_id)
    .eq("person_id", person_id)
    .eq("tech_id", tech_id)
    .eq("is_active", true)
    .maybeSingle();

  if (workforceErr) {
    return NextResponse.json({ ok: false, error: workforceErr.message }, { status: 500 });
  }

  const match = workforce as WorkforceMatch | null;

  if (!match?.assignment_id || !match?.person_id || !match?.tech_id) {
    return NextResponse.json(
      { ok: false, error: "technician does not resolve to current workforce/core person" },
      { status: 400 }
    );
  }

  const payload = rows.map((row) => ({
    pc_org_id: guard.pc_org_id,
    tech_id,
    person_id,
    assignment_id,
    shift_date: row.shift_date,
    exception_type: String(row.exception_type ?? "MANUAL").trim() || "MANUAL",
    force_off: !!row.force_off,
    override_route_id: row.override_route_id ?? null,
    override_hours: row.override_hours ?? null,
    override_units: row.override_units ?? null,
    notes: row.notes ?? null,
    requested_by: guard.user.id,
    approved: false,
    approved_by: null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin.from("schedule_exception_day").upsert(payload, {
    onConflict: "pc_org_id,shift_date,tech_id",
    ignoreDuplicates: false,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    row_count: payload.length,
  });
}