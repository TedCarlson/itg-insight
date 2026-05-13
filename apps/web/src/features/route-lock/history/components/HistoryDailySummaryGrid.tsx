// path: apps/web/src/features/route-lock/history/components/HistoryDailySummaryGrid.tsx

"use client";

import type { CheckInDailySummaryRow, CheckInWeeklyRow } from "../lib/history.types";

function formatDecimal(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits);
}

function formatWorkedDate(dateOnly: string) {
  const d = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateOnly;

  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${weekday} ${mm}-${dd}`;
}

function signalPill(row: CheckInDailySummaryRow) {
  if (row.signal === "SLA") {
    return (
      <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
        SLA Activity
      </span>
    );
  }

  if (row.signal === "PRODUCTION") {
    return (
      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
        Production
      </span>
    );
  }

  if (row.signal === "SCHEDULED_NO_PRODUCTION") {
    return (
      <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
        Scheduled / No Production
      </span>
    );
  }

  if (row.signal === "OFF_SCHEDULE_WORK") {
    return (
      <span className="rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
        Off-Schedule Work
      </span>
    );
  }

  return (
    <span className="rounded-full border border-[var(--to-border)] bg-[var(--to-surface)] px-2 py-0.5 text-[11px] text-[var(--to-ink-muted)]">
      Off
    </span>
  );
}

export default function HistoryDailySummaryGrid(props: {
  row: CheckInWeeklyRow;
}) {
  const { row } = props;

  return (
    <div className="rounded-2xl border border-[var(--to-border)] bg-[var(--to-surface-2)] p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--to-ink)]">Daily Summary</h3>
        <p className="mt-1 text-xs text-[var(--to-ink-muted)]">
          All seven days in the selected week with production, SLA, and between-job signals.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-[var(--to-surface)]">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-[var(--to-surface-2)]">
            <tr>
              <th className="border-b px-3 py-2 text-left">Day</th>
              <th className="border-b px-3 py-2 text-center">Scheduled</th>
              <th className="border-b px-3 py-2 text-right">Jobs</th>
              <th className="border-b px-3 py-2 text-right">Units</th>
              <th className="border-b px-3 py-2 text-right">Hours</th>
              <th className="border-b px-3 py-2 text-right">Units/Hr</th>
              <th className="border-b px-3 py-2 text-right">SLA</th>
              <th className="border-b px-3 py-2 text-right">Between</th>
              <th className="border-b px-3 py-2 text-left">Signal</th>
            </tr>
          </thead>

          <tbody>
            {row.worked_date_details.map((day) => (
              <tr key={day.shift_date}>
                <td className="border-b px-3 py-2 font-medium">
                  {formatWorkedDate(day.shift_date)}
                </td>

                <td className="border-b px-3 py-2 text-center">
                  {day.is_scheduled ? (
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      Scheduled
                    </span>
                  ) : (
                    <span className="rounded-full border border-[var(--to-border)] bg-[var(--to-surface)] px-2 py-0.5 text-[11px] text-[var(--to-ink-muted)]">
                      Off
                    </span>
                  )}
                </td>

                <td className="border-b px-3 py-2 text-right">{day.actual_jobs}</td>
                <td className="border-b px-3 py-2 text-right">{formatDecimal(day.actual_units)}</td>
                <td className="border-b px-3 py-2 text-right">{formatDecimal(day.actual_hours)}</td>
                <td className="border-b px-3 py-2 text-right">{formatDecimal(day.units_per_hour)}</td>

                <td className="border-b px-3 py-2 text-right">
                  {day.sla_bptrl_jobs > 0 ? (
                    <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                      {day.sla_bptrl_jobs} SLA
                    </span>
                  ) : (
                    <span className="text-[var(--to-ink-muted)]">—</span>
                  )}
                </td>

                <td className="border-b px-3 py-2 text-right">
                  {day.between_job_minutes > 0 ? `${day.between_job_minutes} min` : "—"}
                </td>

                <td className="border-b px-3 py-2">{signalPill(day)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}