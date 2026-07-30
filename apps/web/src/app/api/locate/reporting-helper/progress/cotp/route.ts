import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { loadCotpDailyPayload } from "@/shared/server/locate/reporting-helper/cotpDaily.server";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function defaultRange() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const to = formatter.format(new Date());
  const fromDate = new Date(`${to}T12:00:00-04:00`);
  fromDate.setDate(fromDate.getDate() - 13);
  return { from: formatter.format(fromDate), to };
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const defaults = defaultRange();
  const params = new URL(req.url).searchParams;
  const from = params.get("from") ?? defaults.from;
  const to = params.get("to") ?? defaults.to;

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "from and to must use YYYY-MM-DD" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "From date must be on or before To date" }, { status: 400 });
  }

  try {
    return NextResponse.json(await loadCotpDailyPayload(from, to));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load COTP daily report" }, { status: 500 });
  }
}
