import { supabaseAdmin } from "@/shared/data/supabase/admin";

const TIME_ZONE = "America/New_York";

export type CotpDailyColumn = {
  key: string;
  label: string;
  week_ending_date: string | null;
  record_id: string | null;
  created_at: string | null;
};

export type CotpDailyStateRow = {
  state: string;
  values: Record<string, number>;
  reported_latest_day: boolean;
};

export type CotpDailyPayload = {
  from: string;
  to: string;
  columns: CotpDailyColumn[];
  state_rows: CotpDailyStateRow[];
  summary: {
    states: number;
    days: number;
    latest_day: string | null;
    latest_day_reported_states: number;
  };
};

function nyDayKey(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function labelForDay(day: string) {
  const date = new Date(`${day}T12:00:00-04:00`);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: TIME_ZONE,
  });
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function nyMidnightIso(day: string) {
  const noonUtc = new Date(`${day}T12:00:00Z`);
  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(noonUtc).find((part) => part.type === "timeZoneName")?.value ?? "GMT-4";
  const match = offsetName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = match?.[1] === "-" ? "-" : "+";
  const hours = String(match?.[2] ?? "4").padStart(2, "0");
  const minutes = String(match?.[3] ?? "00").padStart(2, "0");
  return new Date(`${day}T00:00:00${sign}${hours}:${minutes}`).toISOString();
}

function rangeBounds(from: string, to: string) {
  return {
    start: nyMidnightIso(from),
    endExclusive: nyMidnightIso(addDays(to, 1)),
  };
}

export async function loadCotpDailyPayload(from: string, to: string): Promise<CotpDailyPayload> {
  const admin = supabaseAdmin();
  const bounds = rangeBounds(from, to);

  const { data, error } = await admin
    .from("locate_cotp_report_row")
    .select(`
      state_code,
      week_ending_value,
      locate_reporting_record!inner(
        locate_reporting_record_id,
        week_ending_date,
        created_at
      )
    `)
    .gte("locate_reporting_record.created_at", bounds.start)
    .lt("locate_reporting_record.created_at", bounds.endExclusive)
    .order("state_code", { ascending: true });

  if (error) throw new Error(error.message);

  const latestByStateDay = new Map<string, any>();
  const latestRecordByDay = new Map<string, any>();

  for (const row of (Array.isArray(data) ? data : []) as any[]) {
    const record = row.locate_reporting_record;
    const createdAt = String(record?.created_at ?? "");
    const day = nyDayKey(createdAt);
    const state = String(row.state_code ?? "").trim().toUpperCase();
    if (!day || !state || day < from || day > to) continue;

    const grain = `${state}::${day}`;
    const existing = latestByStateDay.get(grain);
    if (!existing || createdAt > String(existing.locate_reporting_record?.created_at ?? "")) {
      latestByStateDay.set(grain, row);
    }

    const existingRecord = latestRecordByDay.get(day);
    if (!existingRecord || createdAt > String(existingRecord.created_at ?? "")) {
      latestRecordByDay.set(day, record);
    }
  }

  const dayKeys = Array.from(latestRecordByDay.keys()).sort();
  const columns: CotpDailyColumn[] = dayKeys.map((day) => {
    const record = latestRecordByDay.get(day);
    return {
      key: day,
      label: labelForDay(day),
      week_ending_date: record?.week_ending_date ?? null,
      record_id: record?.locate_reporting_record_id ?? null,
      created_at: record?.created_at ?? null,
    };
  });

  const stateMap = new Map<string, Record<string, number>>();
  for (const row of latestByStateDay.values()) {
    const state = String(row.state_code).trim().toUpperCase();
    const day = nyDayKey(row.locate_reporting_record?.created_at);
    const value = Number(row.week_ending_value);
    if (!day || !Number.isFinite(value)) continue;
    if (!stateMap.has(state)) stateMap.set(state, {});
    stateMap.get(state)![day] = value;
  }

  const latestDay = dayKeys.at(-1) ?? null;
  const stateRows: CotpDailyStateRow[] = Array.from(stateMap.entries())
    .map(([state, values]) => ({
      state,
      values,
      reported_latest_day: latestDay ? values[latestDay] != null : false,
    }))
    .sort((a, b) => a.state.localeCompare(b.state));

  return {
    from,
    to,
    columns,
    state_rows: stateRows,
    summary: {
      states: stateRows.length,
      days: columns.length,
      latest_day: latestDay,
      latest_day_reported_states: stateRows.filter((row) => row.reported_latest_day).length,
    },
  };
}
