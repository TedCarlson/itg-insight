import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function ymd(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function mmdd(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function hm(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
}

function weekdayMmdd(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return null;

  const weekday = date.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  });

  return `${weekday} ${date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "America/New_York",
  })}`;
}

function dayKey(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function rangeStart(range: string) {
  const now = new Date();
  const normalized = range.toUpperCase();

  if (normalized === "7D") now.setDate(now.getDate() - 7);
  else if (normalized === "14D") now.setDate(now.getDate() - 14);
  else if (normalized === "30D") now.setDate(now.getDate() - 30);
  else return null;

  return now.toISOString();
}

function direction(delta: number | null) {
  if (delta == null) return "—";
  if (delta > 0) return "Up";
  if (delta < 0) return "Down";
  return "Neutral";
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const range = new URL(req.url).searchParams.get("range") ?? "CURRENT_WEEK";
  const requestedRange = range.toUpperCase();
  const start = rangeStart(range);

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("locate_cotp_report_row")
    .select(`
      state_code,
      week_ending_value,
      prior_week_value,
      current_week_trend,
      change_points,
      status,
      locate_reporting_record!inner(
        locate_reporting_record_id,
        week_ending_date,
        source_as_of_at,
        parsed_payload,
        created_at
      )
    `)
    .order("state_code", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allRows = Array.isArray(data) ? data : [];

  const latestWeekEnding = allRows
    .map((row: any) => row.locate_reporting_record?.week_ending_date)
    .filter(Boolean)
    .sort()
    .at(-1);

  const scopedRows = allRows.filter((row: any) => {
    const record = row.locate_reporting_record;
    const asOf = record?.source_as_of_at ?? record?.created_at;

    if (requestedRange === "CURRENT_WEEK") {
      return record?.week_ending_date === latestWeekEnding;
    }

    if (!start) return true;
    return String(asOf ?? "") >= start;
  });

  const latestByGrain = new Map<string, any>();

  for (const row of scopedRows as any[]) {
    const record = row.locate_reporting_record;
    const weekDate = record?.week_ending_date;
    if (!weekDate) continue;

    const asOf = String(record?.source_as_of_at ?? record?.created_at ?? "");
    const grainKey =
      requestedRange === "CURRENT_WEEK"
        ? `${row.state_code}::${asOf}`
        : `${row.state_code}::${weekDate}`;

    const existing = latestByGrain.get(grainKey);
    const existingAsOf = String(
      existing?.locate_reporting_record?.source_as_of_at ??
        existing?.locate_reporting_record?.created_at ??
        ""
    );

    if (!existing || asOf > existingAsOf) {
      latestByGrain.set(grainKey, row);
    }
  }

  const rows = Array.from(latestByGrain.values());

  const currentWeekDayCounts = new Map<string, number>();

  if (requestedRange === "CURRENT_WEEK") {
    for (const row of rows as any[]) {
      const record = row.locate_reporting_record;
      const asOf = record?.source_as_of_at ?? record?.created_at;
      const key = dayKey(asOf);
      if (!key) continue;
      currentWeekDayCounts.set(key, (currentWeekDayCounts.get(key) ?? 0) + 1);
    }
  }

  const weekMap = new Map<string, any>();

  for (const row of rows as any[]) {
    const record = row.locate_reporting_record;
    const weekDate = record?.week_ending_date;
    if (!weekDate) continue;

    const asOf = String(record?.source_as_of_at ?? record?.created_at ?? "");
    const columnKey = requestedRange === "CURRENT_WEEK" ? asOf : weekDate;

    if (!weekMap.has(columnKey)) {
      const baseLabel = record?.parsed_payload?.weekEnding ?? mmdd(weekDate) ?? weekDate;
      const asOfDate = ymd(asOf);
      const asOfTime = hm(asOf);

      const asOfDayKey = dayKey(asOf);
      const showTime =
        requestedRange === "CURRENT_WEEK" &&
        asOfDayKey &&
        (currentWeekDayCounts.get(asOfDayKey) ?? 0) > 1;

      weekMap.set(columnKey, {
        key: columnKey,
        week_ending_date: weekDate,
        base_label: baseLabel,
        record_id: record?.locate_reporting_record_id ?? null,
        overall_performance: record?.parsed_payload?.overallPerformance ?? null,
        as_of_at: asOf,
        as_of_date: asOfDate,
        is_current_week_snapshot: requestedRange === "CURRENT_WEEK",
        week_label:
          requestedRange === "CURRENT_WEEK"
            ? `${weekdayMmdd(asOf) ?? mmdd(asOf) ?? asOfDate}${showTime && asOfTime ? ` ${asOfTime}` : ""}`
            : baseLabel,
      });
    }
  }

  const columns = Array.from(weekMap.values()).sort((a, b) =>
    String(a.as_of_at ?? a.week_ending_date).localeCompare(String(b.as_of_at ?? b.week_ending_date))
  );

  const latestColumn = columns[columns.length - 1] ?? null;

  const decoratedWeeks = columns.map((week) => {
    const isLatest = week.key === latestColumn?.key;

    return {
      ...week,
      is_latest: isLatest,
      week_label:
        requestedRange === "CURRENT_WEEK"
          ? week.week_label
          : isLatest
            ? `${week.base_label} As of ${mmdd(week.as_of_at) ?? week.as_of_date ?? "latest"}`
            : `${week.base_label} Final`,
    };
  });

  const stateMap = new Map<string, any>();

  for (const row of rows as any[]) {
    const record = row.locate_reporting_record;
    const weekDate = record?.week_ending_date;
    if (!weekDate) continue;

    const asOf = String(record?.source_as_of_at ?? record?.created_at ?? "");
    const columnKey = requestedRange === "CURRENT_WEEK" ? asOf : weekDate;

    if (!stateMap.has(row.state_code)) {
      stateMap.set(row.state_code, {
        state: row.state_code,
        snapshots: {},
      });
    }

    stateMap.get(row.state_code).snapshots[columnKey] = {
      value: Number(row.week_ending_value),
      prior_week_value: Number(row.prior_week_value),
      current_week_trend: Number(row.current_week_trend),
      change_points: Number(row.change_points),
      status: row.status,
      as_of_at: asOf,
      record_id: record?.locate_reporting_record_id ?? null,
    };
  }

  const latestColumnKey = latestColumn?.key ?? null;

  const stateRows = Array.from(stateMap.values())
    .map((stateRow) => {
      const ordered = decoratedWeeks
        .map((week) => ({
          week,
          snapshot: stateRow.snapshots[week.key] ?? null,
        }))
        .filter((entry) => entry.snapshot);

      const latest = latestColumnKey ? stateRow.snapshots[latestColumnKey] ?? null : null;
      const previous = ordered
        .filter((entry) => entry.week.key !== latestColumnKey)
        .slice(-1)[0]?.snapshot ?? null;

      const delta =
        latest && previous ? Number(latest.value) - Number(previous.value) : null;

      return {
        state: stateRow.state,
        is_active_latest: Boolean(latest),
        snapshots: stateRow.snapshots,
        latest_value: latest?.value ?? null,
        previous_value: previous?.value ?? null,
        movement_vs_prior_snapshot: delta,
        direction: direction(delta),
        current_week_trend: latest?.current_week_trend ?? null,
        latest_status: latest?.status ?? null,
        latest_as_of_at: latest?.as_of_at ?? null,
        weeks_tracked: ordered.length,
      };
    })
    .sort((a, b) => {
      if (a.is_active_latest !== b.is_active_latest) return a.is_active_latest ? -1 : 1;
      return String(a.state).localeCompare(String(b.state));
    });

  const activeRows = stateRows.filter((row) => row.is_active_latest);

  return NextResponse.json({
    range: requestedRange,
    weeks: decoratedWeeks,
    state_rows: stateRows,
    summary: {
      latest_week: decoratedWeeks[decoratedWeeks.length - 1] ?? null,
      active_states: activeRows.length,
      historical_states: stateRows.length - activeRows.length,
      improved_count: activeRows.filter((row) => row.direction === "Up").length,
      declined_count: activeRows.filter((row) => row.direction === "Down").length,
      neutral_count: activeRows.filter((row) => row.direction === "Neutral").length,
      needs_attention_count: activeRows.filter(
        (row) => String(row.latest_status ?? "").toLowerCase() === "needs attention"
      ).length,
      watch_closely_count: activeRows.filter(
        (row) => String(row.latest_status ?? "").toLowerCase() === "watch closely"
      ).length,
    },
  });
}
