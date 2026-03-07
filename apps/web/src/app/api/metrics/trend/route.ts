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

  pool.sort((a, b) => String(b?.start_date ?? "").localeCompare(String(a?.start_date ?? "")));
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

function directionForKpi(kpiKey: string): "HIGHER_BETTER" | "LOWER_BETTER" {
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

  if (!["FM", "3FM", "12FM"].includes(fiscal_window)) {
    return NextResponse.json({ error: "Invalid fiscal_window" }, { status: 400 });
  }

  const sb = await supabaseServer();
  const admin = supabaseAdmin();
  const today = isoToday();

  const { data: assignments, error: asgErr } = await admin
    .from("assignment")
    .select("tech_id,start_date,end_date,active")
    .eq("pc_org_id", pc_org_id)
    .eq("person_id", person_id)
    .limit(200);

  if (asgErr) {
    return NextResponse.json({ error: asgErr.message }, { status: 500 });
  }

  const tech_id = pickBestTechId((assignments ?? []) as AssignmentRow[], today);

  if (!tech_id) {
    return NextResponse.json({
      kpi_key,
      fiscal_window,
      direction: directionForKpi(kpi_key),
      series: [],
      overlays: {
        short_window_label: "recent",
        long_window_label: "baseline",
        short_avg: null,
        long_avg: null,
        delta: null,
        state: "NO_DATA",
      },
    });
  }

  const { data: currentFiscal, error: curErr } = await sb
    .from("fiscal_month_dim")
    .select("month_key,start_date,end_date")
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  if (curErr) {
    return NextResponse.json({ error: curErr.message }, { status: 500 });
  }

  if (!currentFiscal) {
    return NextResponse.json({
      kpi_key,
      fiscal_window,
      direction: directionForKpi(kpi_key),
      series: [],
      overlays: {
        short_window_label: "recent",
        long_window_label: "baseline",
        short_avg: null,
        long_avg: null,
        delta: null,
        state: "NO_DATA",
      },
    });
  }

  const monthLimit = fiscal_window === "FM" ? 1 : fiscal_window === "3FM" ? 3 : 12;

  const { data: months, error: monthErr } = await sb
    .from("fiscal_month_dim")
    .select("month_key,end_date")
    .lte("month_key", String((currentFiscal as FiscalMonthRow).month_key))
    .order("month_key", { ascending: false })
    .limit(monthLimit);

  if (monthErr) {
    return NextResponse.json({ error: monthErr.message }, { status: 500 });
  }

  const fiscalRows = (months ?? []) as Array<Pick<FiscalMonthRow, "month_key" | "end_date">>;
  const fiscalEndDates = fiscalRows.map((m) => String(m.end_date).slice(0, 10));
  const fiscalMonthByEndDate = new Map(
    fiscalRows.map((m) => [String(m.end_date).slice(0, 10), String(m.month_key)] as const)
  );

  if (!fiscalEndDates.length) {
    return NextResponse.json({
      kpi_key,
      fiscal_window,
      direction: directionForKpi(kpi_key),
      series: [],
      overlays: {
        short_window_label: "recent",
        long_window_label: "baseline",
        short_avg: null,
        long_avg: null,
        delta: null,
        state: "NO_DATA",
      },
    });
  }

  const { data: facts, error: factErr } = await sb
    .from("metrics_tech_fact_day")
    .select(`
      metric_date,
      fiscal_end_date,
      tnps_score,
      ftr_rate,
      tool_usage_rate,
      contact_48hr_rate,
      pht_pure_pass_rate,
      met_rate,
      soi_rate,
      repeat_rate,
      rework_rate,
      tnps_surveys,
      total_ftr_contact_jobs,
      tu_eligible_jobs,
      total_met_appts,
      total_jobs
    `)
    .eq("pc_org_id", pc_org_id)
    .eq("tech_id", tech_id)
    .in("fiscal_end_date", fiscalEndDates)
    .order("metric_date", { ascending: true });

  if (factErr) {
    return NextResponse.json({ error: factErr.message }, { status: 500 });
  }

  const sampleField = sampleFieldForKpi(kpi_key);
  const factRows = (facts ?? []) as FactRow[];

  const series = factRows.map((row) => {
    const fiscalEndDate = String(row.fiscal_end_date).slice(0, 10);
    const valueRaw = row[kpi_key as keyof FactRow];
    const sampleRaw = sampleField ? row[sampleField] : null;

    return {
      fiscal_month: fiscalMonthByEndDate.get(fiscalEndDate) ?? fiscalEndDate.slice(0, 7),
      metric_date: String(row.metric_date).slice(0, 10),
      value: numOrNull(valueRaw),
      sample: numOrNull(sampleRaw),
    };
  });

  const values = series
    .map((s) => s.value)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const shortSlice = values.slice(-Math.min(3, values.length));
  const longSlice = values;

  const short_avg = average(shortSlice);
  const long_avg = average(longSlice);
  const delta = short_avg !== null && long_avg !== null ? short_avg - long_avg : null;

  let state = "NO_DATA";
  if (delta !== null) {
    if (Math.abs(delta) < 0.0001) state = "FLAT";
    else if (directionForKpi(kpi_key) === "HIGHER_BETTER") state = delta > 0 ? "UP" : "DOWN";
    else state = delta < 0 ? "UP" : "DOWN";
  }

  return NextResponse.json({
    kpi_key,
    fiscal_window,
    direction: directionForKpi(kpi_key),
    series,
    overlays: {
      short_window_label: "recent",
      long_window_label: "baseline",
      short_avg,
      long_avg,
      delta,
      state,
    },
  });
}