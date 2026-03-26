import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type RangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

export type RawMetricRow = {
  tech_id: string;
  metric_date: string;
  fiscal_end_date: string;
  batch_id: string;
  inserted_at: string;
  raw: Record<string, unknown>;
};

type FiscalMonthDimRow = {
  fiscal_month_id: string;
  start_date: string;
  end_date: string;
  label?: string | null;
};

function todayInNY(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function monthsToTake(range: RangeKey) {
  if (range === "12FM") return 12;
  if (range === "3FM") return 3;
  return 1;
}

export function parseRaw(raw: unknown): Record<string, unknown> {
  if (!raw) return {};

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

export function pickNum(
  obj: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const value = obj?.[key];
    if (value == null) continue;

    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

export function avgOrNull(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computePct(
  denominator: number,
  numerator: number
): number | null {
  if (denominator > 0) return (100 * numerator) / denominator;
  return null;
}

export function computeTnpsScore(
  surveys: number,
  promoters: number,
  detractors: number
): number | null {
  if (surveys > 0) return (100 * (promoters - detractors)) / surveys;
  return null;
}

async function resolveCurrentFiscalMonth(
  admin: ReturnType<typeof supabaseAdmin>
): Promise<FiscalMonthDimRow | null> {
  const today = todayInNY();

  const { data, error } = await admin
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.fiscal_month_id) return null;

  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date).slice(0, 10),
    end_date: String(data.end_date).slice(0, 10),
    label: data.label ?? null,
  };
}

export async function resolveFiscalEndDatesForRange(args: {
  admin?: ReturnType<typeof supabaseAdmin>;
  range: RangeKey;
}): Promise<string[]> {
  const admin = args.admin ?? supabaseAdmin();

  const current = await resolveCurrentFiscalMonth(admin);
  if (!current) return [];

  const monthCount = monthsToTake(args.range);

  const upperBound =
    args.range === "PREVIOUS" ? current.start_date : current.end_date;

  const query = admin
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .lte("end_date", upperBound)
    .order("end_date", { ascending: false })
    .limit(args.range === "PREVIOUS" ? 2 : monthCount);

  const { data, error } = await query;

  if (error) {
    throw new Error(`resolveFiscalEndDatesForRange failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    fiscal_month_id?: unknown;
    start_date?: unknown;
    end_date?: unknown;
    label?: unknown;
  }>;

  const normalized = rows
    .filter((row) => row?.fiscal_month_id && row?.end_date)
    .map((row) => ({
      fiscal_month_id: String(row.fiscal_month_id),
      start_date: String(row.start_date ?? "").slice(0, 10),
      end_date: String(row.end_date).slice(0, 10),
      label: row.label == null ? null : String(row.label),
    }));

  if (args.range === "PREVIOUS") {
    return normalized[1]?.end_date ? [normalized[1].end_date] : [];
  }

  return normalized.slice(0, monthCount).map((row) => row.end_date);
}

export async function fetchMetricRawRows(args: {
  admin?: ReturnType<typeof supabaseAdmin>;
  techIds: string[];
  pcOrgIds: string[];
  fiscalEndDates?: string[];
}): Promise<RawMetricRow[]> {
  const admin = args.admin ?? supabaseAdmin();

  if (!args.techIds.length || !args.pcOrgIds.length) {
    return [];
  }

  let query = admin
    .from("metrics_raw_row")
    .select("tech_id,metric_date,fiscal_end_date,batch_id,inserted_at,raw")
    .in("pc_org_id", args.pcOrgIds)
    .in("tech_id", args.techIds);

  if (args.fiscalEndDates?.length) {
    query = query.in("fiscal_end_date", args.fiscalEndDates);
  }

  const { data, error } = await query
    .order("fiscal_end_date", { ascending: false })
    .order("metric_date", { ascending: false })
    .order("inserted_at", { ascending: false })
    .limit(10000);

  if (error) {
    throw new Error(`fetchMetricRawRows failed: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    tech_id: String(row.tech_id ?? ""),
    metric_date: String(row.metric_date ?? "").slice(0, 10),
    fiscal_end_date: String(row.fiscal_end_date ?? "").slice(0, 10),
    batch_id: String(row.batch_id ?? ""),
    inserted_at: String(row.inserted_at ?? ""),
    raw: parseRaw(row.raw),
  }));
}

export function groupRowsByTech(rows: RawMetricRow[]) {
  const map = new Map<string, RawMetricRow[]>();

  for (const row of rows) {
    const arr = map.get(row.tech_id) ?? [];
    arr.push(row);
    map.set(row.tech_id, arr);
  }

  return map;
}

export function groupRowsByFiscalMonth(rows: RawMetricRow[]) {
  const map = new Map<string, RawMetricRow[]>();

  for (const row of rows) {
    const arr = map.get(row.fiscal_end_date) ?? [];
    arr.push(row);
    map.set(row.fiscal_end_date, arr);
  }

  return map;
}

export function getFinalRowsPerMonth(rows: RawMetricRow[]) {
  const grouped = groupRowsByFiscalMonth(rows);
  const out: Array<{
    fiscal_end_date: string;
    row: RawMetricRow;
    rows_in_month: number;
  }> = [];

  for (const [fiscal_end_date, arr] of grouped) {
    arr.sort((a, b) => {
      const byMetricDate = b.metric_date.localeCompare(a.metric_date);
      if (byMetricDate !== 0) return byMetricDate;

      const byInsertedAt = b.inserted_at.localeCompare(a.inserted_at);
      if (byInsertedAt !== 0) return byInsertedAt;

      return b.batch_id.localeCompare(a.batch_id);
    });

    out.push({
      fiscal_end_date,
      row: arr[0],
      rows_in_month: arr.length,
    });
  }

  out.sort((a, b) => b.fiscal_end_date.localeCompare(a.fiscal_end_date));
  return out;
}