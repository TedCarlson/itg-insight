import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const payload = {
      country_code: clean(body.countryCode || "US").toUpperCase(),
      label: clean(body.label),
      start_date: clean(body.startDate),
      end_date: clean(body.endDate),
      source_holiday_id: body.sourceHolidayId
        ? clean(body.sourceHolidayId)
        : null,
      blackout_type: clean(body.blackoutType || "holiday_weekend"),
      manager_controlled_request_entry:
        body.managerControlledRequestEntry === true,
      active: body.active !== false,
      notes: body.notes ? clean(body.notes) : null,
    };

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("calendar_blackout_rule")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown_error" },
      { status: 500 },
    );
  }
}
