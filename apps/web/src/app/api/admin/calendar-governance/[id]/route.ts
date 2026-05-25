import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await req.json();

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("calendar_blackout_rule")
    .update({
      label: clean(body.label),
      start_date: clean(body.startDate),
      end_date: clean(body.endDate),
      blackout_type: clean(body.blackoutType || "holiday_weekend"),
      manager_controlled_request_entry:
        body.managerControlledRequestEntry === true,
      active: body.active === true,
      notes: body.notes ? clean(body.notes) : null,
    })
    .eq("blackout_rule_id", clean(id))
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, data });
}
