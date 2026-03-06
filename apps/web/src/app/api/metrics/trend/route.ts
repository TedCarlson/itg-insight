import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

type FiscalWindow = "FM" | "3FM" | "12FM";

type AssignmentRow = {
  tech_id: string | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean | null;
};

type FiscalMonthRow = {
  month_key: string;
  start_date: string;
  end_date: string;
};

type FactRow = {
  metric_date: string;
  fiscal_end_date: string;

  tnps_score?: number | string | null;
  ftr_rate?: number | string | null;
  tool_usage_rate?: number | string | null;
  contact_48hr_rate?: number | string | null;
  pht_pure_pass_rate?: number | string | null;
  met_rate?: number | string | null;
  soi_rate?: number | string | null;
  repeat_rate?: number | string | null;
  rework_rate?: number | string | null;

  tnps_surveys?: number | string | null;
  total_ftr_contact_jobs?: number | string | null;
  tu_eligible_jobs?: number | string | null;
  total_met_appts?: number | string | null;
  total_jobs?: number | string | null;
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function isActiveWindow(row: AssignmentRow, today: string) {
  const activeOk = row?.active === true || row?.active == null;
  const startOk = !row?.start_date || String(row.start_date) <= today;
  const endOk = !row?.end_date || String(row.end_date) >= today;
  return activeOk && startOk && endOk;
}

function pickBestTechId(assignments: AssignmentRow[], today: string): string | null {
  if (!assignments.length) return null;

  const current = assignments.filter((a) => isActiveWindow(a, today) && a?.tech_id);
  const pool = current.length ? current : assignments.filter((a) => a?.tech_id);

  pool.sort((a, b) =>
    String(b?.start_date ?? "").localeCompare(String(a?.start_date ?? ""))
  );

  const best = pool[0]?.tech_id ? String(pool[0].tech_id).trim() : "";
  return best || null;
}

function sampleFieldForKpi(kpiKey: string): keyof FactRow | null {
  switch (kpiKey) {
    case "tnps_score":
      return "tnps_surveys";
    case "ftr_rate":
      return "total_ftr_contact_jobs";
    case "tool_usage_rate":
      return "tu_eligible_jobs";
    case "contact_48hr_rate":
      return "total_ftr_contact_jobs";
    case "pht_pure_pass_rate":
      return "total_jobs";
    case "met_rate":
      return "total_met_appts";
    case "soi_rate":
      return "total_jobs";
    case "repeat_rate":
      return "total_jobs";
    case "rework_rate":
      return "total_jobs";
    default:
      return null;
  }
}

function directionForKpi(
  kpiKey: string
): "HIGHER_BETTER" | "LOWER_BETTER" {
  if (
    kpiKey === "contact_48hr_rate" ||
    kpiKey === "repeat_rate" ||
    kpiKey === "rework_rate" ||
    kpiKey === "soi_rate"
  ) {
    return "LOWER_BETTER";
  }
  return "HIGHER_BETTER";
}

function average(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const pc_org_id = searchParams.get("pc_org_id");
  const person_id = searchParams.get("person_id");
  const kpi_key = searchParams.get("kpi_key");
  const fiscal_window = (searchParams.get("fiscal_window") || "FM") as FiscalWindow;

  if (!pc_org_id || !person_id || !kpi_key) {
    return NextResponse.json(
      { error: "pc_org_id, person_id, and kpi_key are required" },
      { status: 400 }
    );
  }

  const sb = await supabaseServer();
  const admin = supabaseAdmin();
  const today = isoToday();

  /**
   * Resolve tech_id from assignment
   */
  const { data: assignments } = await admin
    .from("assignment")
    .select("tech_id,start_date,end_date,active")
    .eq("pc_org_id", pc_org_id)
    .eq("person_id", person_id);

  const tech_id = pickBestTechId((assignments ?? []) as AssignmentRow[], today);

  if (!tech_id) {
    return NextResponse.json({
      kpi_key,
      fiscal_window,
      direction: directionForKpi(kpi_key),
      series: [],
      overlays: { short_avg: null, long_avg: null, delta: null, state: "NO_DATA" },
    });
  }

  /**
   * Find current fiscal month
   */
  const { data: currentFiscal } = await sb
    .from("fiscal_month_dim")
    .select("month_key,start_date,end_date")
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  if (!currentFiscal) {
    return NextResponse.json({
      kpi_key,
      fiscal_window,
      direction: directionForKpi(kpi_key),
      series: [],
      overlays: { short_avg: null, long_avg: null, delta: null, state: "NO_DATA" },
    });
  }

  /**
   * Determine fiscal window
   */
  const monthLimit =
    fiscal_window === "FM" ? 1 : fiscal_window === "3FM" ? 3 : 12;

  const { data: months } = await sb
    .from("fiscal_month_dim")
    .select("month_key,end_date")
    .lte("month_key", currentFiscal.month_key)
    .order("month_key", { ascending: false })
    .limit(monthLimit);

  const fiscalEndDates = (months ?? []).map((m: any) =>
    String(m.end_date).slice(0, 10)
  );

  /**
   * Load facts
   */
  const { data: facts } = await sb
    .from("metrics_tech_fact_day")
    .select("*")
    .eq("pc_org_id", pc_org_id)
    .eq("tech_id", tech_id)
    .in("fiscal_end_date", fiscalEndDates)
    .order("metric_date", { ascending: true });

  const sampleField = sampleFieldForKpi(kpi_key);
  const factRows = (facts ?? []) as FactRow[];

  const series = factRows.map((row) => ({
    metric_date: String(row.metric_date).slice(0, 10),
    value: numOrNull((row as any)[kpi_key]),
    sample: sampleField ? numOrNull((row as any)[sampleField]) : null,
  }));

  const values = series
    .map((s) => s.value)
    .filter((v): v is number => typeof v === "number");

  const shortSlice = values.slice(-Math.min(3, values.length));
  const longSlice = values;

  const short_avg = average(shortSlice);
  const long_avg = average(longSlice);
  const delta =
    short_avg !== null && long_avg !== null ? short_avg - long_avg : null;

  let state = "NO_DATA";

  if (delta !== null) {
    if (Math.abs(delta) < 0.0001) state = "FLAT";
    else if (directionForKpi(kpi_key) === "HIGHER_BETTER")
      state = delta > 0 ? "UP" : "DOWN";
    else state = delta < 0 ? "UP" : "DOWN";
  }

  return NextResponse.json({
    kpi_key,
    fiscal_window,
    direction: directionForKpi(kpi_key),
    series,
    overlays: {
      short_avg,
      long_avg,
      delta,
      state,
    },
  });
}