import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

type SeatType =
  | "FIELD"
  | "LEADERSHIP"
  | "SUPPORT"
  | "TRAVEL"
  | "DROP_BURY"
  | "TRAINING"
  | "FMLA";

type RequestBody = {
  assignment_id: string;
  changes: {
    person_id?: string;
    pc_org_id?: string | null;
    tech_id?: string | null;
    position_title?: string | null;
    office_id?: string | null;
    affiliation_id?: string | null;
    reports_to_assignment_id?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    seat_type?: SeatType;
  };
};

function isSeatType(value: unknown): value is SeatType {
  return (
    value === "FIELD" ||
    value === "LEADERSHIP" ||
    value === "SUPPORT" ||
    value === "TRAVEL" ||
    value === "DROP_BURY" ||
    value === "TRAINING" ||
    value === "FMLA"
  );
}

function clean(value: string | null | undefined) {
  const next = String(value ?? "").trim();
  return next || null;
}

export async function POST(req: Request) {
  const userClient = await supabaseServer();
  const adminClient = await supabaseAdmin();

  const {
    data: { user },
  } = await userClient.auth.getUser();

  let body: RequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { assignment_id, changes } = body;
  const isNew = assignment_id === "NEW";

  if (!assignment_id || !changes) {
    return NextResponse.json(
      { error: "Missing assignment_id or changes" },
      { status: 400 }
    );
  }

  if (isNew && !changes.person_id) {
    return NextResponse.json(
      { error: "Missing person_id for new workforce assignment" },
      { status: 400 }
    );
  }

  if (isNew && !changes.pc_org_id) {
    return NextResponse.json(
      { error: "Missing pc_org_id for new workforce assignment" },
      { status: 400 }
    );
  }

  if ("seat_type" in changes && !isSeatType(changes.seat_type)) {
    return NextResponse.json({ error: "Invalid seat_type" }, { status: 400 });
  }

  if (
    !isNew &&
    changes.reports_to_assignment_id &&
    changes.reports_to_assignment_id === assignment_id
  ) {
    return NextResponse.json(
      { error: "Assignment cannot report to itself" },
      { status: 400 }
    );
  }

  const { data, error } = await adminClient.rpc("workforce_update_assignment", {
    p_assignment_id: isNew ? null : assignment_id,
    p_person_id: isNew ? changes.person_id ?? null : null,
    p_pc_org_id: isNew ? changes.pc_org_id ?? null : null,
    p_tech_id: isNew ? clean(changes.tech_id) : null,
    p_position_title:
      "position_title" in changes ? changes.position_title : null,
    p_office_id: "office_id" in changes ? changes.office_id : null,
    p_affiliation_id:
      "affiliation_id" in changes ? changes.affiliation_id : null,
    p_reports_to_assignment_id:
      "reports_to_assignment_id" in changes
        ? changes.reports_to_assignment_id
        : null,
    p_start_date: "start_date" in changes ? changes.start_date : null,
    p_role_type: "seat_type" in changes ? changes.seat_type : null,
    p_auth_user_id: user?.id ?? null,
    p_end_date: "end_date" in changes ? changes.end_date : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.ok) {
    return NextResponse.json(
      { error: data?.error ?? "Unable to update assignment" },
      { status: isNew ? 400 : 404 }
    );
  }

  return NextResponse.json({ ok: true });
}