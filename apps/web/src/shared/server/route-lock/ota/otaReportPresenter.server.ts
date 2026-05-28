// path: apps/web/src/shared/server/route-lock/ota/otaReportPresenter.server.ts

import { buildWeeks } from "./otaDateUtils.server";
import type {
  OtaDayGroup,
  OtaFirstJobRow,
  OtaReportPayload,
  OtaReportScope,
} from "./otaReportTypes";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function formatDuration(minutes: number | null) {
  if (minutes == null || !Number.isFinite(minutes)) return "—";

  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;

  if (hh === 0) return `${sign}${mm}m`;

  return `${sign}${hh}:${String(mm).padStart(2, "0")}`;
}

function eligibleRows(rows: OtaFirstJobRow[]) {
  return rows.filter((row) => row.is_ttfj_eligible && typeof row.ttfj_minutes === "number");
}

function lateRows(rows: OtaFirstJobRow[]) {
  return rows.filter((row) => row.is_ttfj_eligible && Number(row.late_minutes ?? 0) > 0);
}

function avgTtfj(rows: OtaFirstJobRow[]) {
  const eligible = eligibleRows(rows);
  if (eligible.length === 0) return null;

  return round1(
    eligible.reduce((sum, row) => sum + Number(row.ttfj_minutes), 0) / eligible.length
  );
}

function sortDetailRows(rows: OtaFirstJobRow[]) {
  return [...rows].sort((a, b) => {
    const aLate = Number(a.late_minutes ?? 0);
    const bLate = Number(b.late_minutes ?? 0);

    if (aLate !== bLate) return bLate - aLate;

    return `${a.affiliation ?? ""}${a.full_name}${a.shift_date}`.localeCompare(
      `${b.affiliation ?? ""}${b.full_name}${b.shift_date}`
    );
  });
}

function summarizeRows(rows: OtaFirstJobRow[]) {
  const eligible = eligibleRows(rows);
  const late = lateRows(rows);
  const avg = avgTtfj(rows);
  const worst = late.reduce((max, row) => Math.max(max, Number(row.late_minutes ?? 0)), 0);

  return {
    first_jobs: rows.length,
    eligible_count: eligible.length,
    on_time_or_grace: eligible.length - late.length,
    late_count: late.length,
    late_rate: eligible.length > 0 ? round1((late.length / eligible.length) * 100) : 0,
    avg_ttfj_minutes: avg,
    avg_ttfj_display: formatDuration(avg == null ? null : Math.round(avg)),
    worst_late_minutes: worst,
    worst_late_display: formatDuration(worst),
  };
}

function buildDayGroups(rows: OtaFirstJobRow[]): OtaDayGroup[] {
  const byDate = new Map<string, OtaFirstJobRow[]>();

  for (const row of rows) {
    if (!byDate.has(row.shift_date)) byDate.set(row.shift_date, []);
    byDate.get(row.shift_date)?.push(row);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([shiftDate, dayRows]) => {
      const sortedRows = sortDetailRows(dayRows);
      const summary = summarizeRows(sortedRows);
      const status: OtaDayGroup["status"] =
        summary.late_count > 0
          ? "NEEDS_ATTENTION"
          : sortedRows.length > 0
            ? "CLEAN"
            : "NO_DATA";

      return {
        shift_date: shiftDate,
        weekday_label: sortedRows[0]?.weekday_label ?? "",
        ...summary,
        status,
        rows: sortedRows,
      };
    });
}

export function presentOtaReport(input: {
  scope: OtaReportScope;
  anchor: string;
  from: string;
  to: string;
  label: string;
  previousAnchor: string;
  nextAnchor: string;
  rows: OtaFirstJobRow[];
}): OtaReportPayload {
  const weeks = buildWeeks(input.from, input.to).map((week) => {
    const rows = input.rows.filter(
      (row) => row.shift_date >= week.week_start && row.shift_date <= week.week_end
    );

    const dayGroups = buildDayGroups(rows);
    const summary = summarizeRows(rows);

    const status: "CLEAN" | "NEEDS_ATTENTION" | "NO_DATA" =
      summary.late_count > 0 ? "NEEDS_ATTENTION" : rows.length > 0 ? "CLEAN" : "NO_DATA";

    return {
      ...week,
      ...summary,
      status,
      day_groups: dayGroups,
    };
  });

  const summary = summarizeRows(input.rows);

  return {
    ok: true,
    scope: input.scope,
    anchor: input.anchor,
    window: {
      from: input.from,
      to: input.to,
      label: input.label,
      previous_anchor: input.previousAnchor,
      next_anchor: input.nextAnchor,
    },
    summary: {
      first_jobs: summary.first_jobs,
      eligible_count: summary.eligible_count,
      late_count: summary.late_count,
      late_rate: summary.late_rate,
      avg_ttfj_minutes: summary.avg_ttfj_minutes,
      avg_ttfj_display: summary.avg_ttfj_display,
      worst_late_minutes: summary.worst_late_minutes,
      worst_late_display: summary.worst_late_display,
    },
    weeks,
  };
}
