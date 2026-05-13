// path: apps/web/src/features/route-lock/history/components/HistoryCheckInWeeklyCard.tsx

"use client";

import { Fragment, useMemo } from "react";
import type { CheckInWeekJobRow, CheckInWeeklyRow } from "../lib/history.types";
import HistoryDailySummaryGrid from "./HistoryDailySummaryGrid";
import { exportTechHistoryExcel } from "../lib/exportTechHistoryExcel";


function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toLocaleString() : "0";
}

function formatDecimal(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits);
}

function formatWeekLabel(row: CheckInWeeklyRow) {
  return `Wk ${row.calendar_week} / ${row.calendar_year}`;
}

function formatWorkedDate(dateOnly: string) {
  const d = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateOnly;

  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${weekday} ${mm}-${dd}`;
}

function formatShortDate(dateOnly: string) {
  const d = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateOnly;

  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${mm}/${dd}`;
}

function formatHoursMinutes(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";

  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h <= 0) return `${m} min`;
  if (m <= 0) return `${h} hr`;

  return `${h} hr ${m} min`;
}

function getDayDetail(row: CheckInWeeklyRow, date: string) {
  return row.worked_date_details.find((item) => item.shift_date === date) ?? null;
}

function weekdayColumns(row: CheckInWeeklyRow) {
  const start = new Date(`${row.week_start}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  return Array.from({ length: 7 }).map((_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return d.toISOString().slice(0, 10);
  });
}

function jobSignal(job: CheckInWeekJobRow) {
  if (job.is_sla_bptrl) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
        SLA
      </span>
    );
  }

  return <span className="text-[var(--to-ink-muted)]">BAU</span>;
}

function isFirstJobForDate(jobs: CheckInWeekJobRow[], index: number) {
  if (index === 0) return true;
  return jobs[index - 1]?.shift_date !== jobs[index]?.shift_date;
}

export default function HistoryCheckInWeeklyCard(props: {
  rows: CheckInWeeklyRow[];
  loading: boolean;
  error: string | null;
  selectedTechLabel: string | null;
  selectedAffiliation: string | null;
  fromDate: string;
  toDate: string;
}) {
  const { rows, loading, error, selectedTechLabel, selectedAffiliation, fromDate, toDate } = props;

  const primaryRow = rows[0] ?? null;

  const metaWeekLabel = useMemo(() => {
    const first = rows[0];
    if (!first) return `${formatShortDate(fromDate)}–${formatShortDate(toDate)}`;
    return `${formatWeekLabel(first)} • ${formatShortDate(fromDate)}–${formatShortDate(toDate)}`;
  }, [fromDate, rows, toDate]);

  return (
    <section className="space-y-3 rounded-2xl border bg-[var(--to-surface)] p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
            Weekly Check-In Summary
          </h2>
          <p className="text-xs text-[var(--to-ink-muted)]">
            Sunday to Saturday grouped actuals with productivity rates and SLA/BPTRL trial markers.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {selectedTechLabel ? (
            <span className="rounded-full border border-[var(--to-border)] bg-[var(--to-surface-2)] px-3 py-1 font-medium text-[var(--to-ink)]">
              {selectedTechLabel}
            </span>
          ) : null}

          {selectedAffiliation ? (
            <span className="rounded-full border border-[var(--to-border)] bg-[var(--to-surface-2)] px-3 py-1 text-[var(--to-ink-muted)]">
              {selectedAffiliation}
            </span>
          ) : null}

          <span className="rounded-full border border-[var(--to-border)] bg-[var(--to-surface-2)] px-3 py-1 text-[var(--to-ink-muted)]">
            {metaWeekLabel}
          </span>

          <button
            type="button"
            onClick={() =>
              exportTechHistoryExcel({
                selectedTechLabel,
                selectedAffiliation,
                fromDate,
                toDate,
                rows,
              })
            }
            disabled={!rows.length}
            className="rounded-full border border-[var(--to-border)] bg-[var(--to-surface-2)] px-3 py-1 text-xs font-medium text-[var(--to-ink)] hover:bg-[var(--to-surface)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export Excel
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--to-ink-muted)]">Loading check-in weekly summary…</p>
      ) : error ? (
        <p className="text-sm text-[var(--to-danger,#b91c1c)]">{error}</p>
      ) : primaryRow ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-[var(--to-border)]">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[var(--to-surface-2)]">
                <tr>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-left font-semibold text-[var(--to-ink)]">
                    Week
                  </th>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <th
                      key={day}
                      className="border-b border-[var(--to-border)] px-2 py-2 text-center font-semibold text-[var(--to-ink)]"
                    >
                      {day}
                    </th>
                  ))}
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-right font-semibold text-[var(--to-ink)]">
                    Jobs
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-right font-semibold text-[var(--to-ink)]">
                    Units
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-right font-semibold text-[var(--to-ink)]">
                    Hours
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-right font-semibold text-[var(--to-ink)]">
                    Units/Hr
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-right font-semibold text-[var(--to-ink)]">
                    SLA Jobs
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr key={`${primaryRow.week_start}:${primaryRow.week_end}:${primaryRow.tech_id}`}>
                  <td className="border-b border-[var(--to-border)] px-3 py-2 text-[var(--to-ink)]">
                    <div className="font-medium">{formatWeekLabel(primaryRow)}</div>
                    <div className="text-xs text-[var(--to-ink-muted)]">
                      {formatShortDate(primaryRow.week_start)}–
                      {formatShortDate(primaryRow.week_ending_saturday || primaryRow.week_end)}
                    </div>
                  </td>

                  {weekdayColumns(primaryRow).map((date) => {
                    const day = getDayDetail(primaryRow, date);
                    const isWorked = Boolean(day?.is_worked);
                    const slaJobs = day?.sla_bptrl_jobs ?? 0;
                    const isSla = slaJobs > 0;

                    return (
                      <td key={date} className="border-b border-[var(--to-border)] px-2 py-2 text-center">
                        {isWorked ? (
                          <span
                            title={isSla ? `${slaJobs} SLA/BPTRL job(s)` : "BAU production day"}
                            className={
                              isSla
                                ? "inline-flex min-w-14 justify-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                                : "inline-flex min-w-14 justify-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                            }
                          >
                            {isSla ? `${slaJobs} SLA` : `${day?.actual_jobs ?? 0} jobs`}
                          </span>
                        ) : (
                          <span className="inline-flex min-w-14 justify-center rounded-full border border-[var(--to-border)] bg-[var(--to-surface)] px-2 py-0.5 text-xs text-[var(--to-ink-muted)]">
                            Off
                          </span>
                        )}
                      </td>
                    );
                  })}

                  <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                    {formatNumber(primaryRow.actual_jobs)}
                  </td>
                  <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                    {formatNumber(primaryRow.actual_units)}
                  </td>
                  <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                    {formatDecimal(primaryRow.actual_hours)}
                  </td>
                  <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                    {formatDecimal(primaryRow.units_per_hour)}
                  </td>
                  <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                    {primaryRow.sla_bptrl_jobs > 0 ? (
                      <div>
                        <div className="font-medium">{formatNumber(primaryRow.sla_bptrl_jobs)}</div>
                        <div className="text-xs text-[var(--to-ink-muted)]">
                          {formatDecimal(primaryRow.sla_bptrl_units)} units
                        </div>
                      </div>
                    ) : (
                      <span className="text-[var(--to-ink-muted)]">—</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <HistoryDailySummaryGrid row={primaryRow} />

          <div className="rounded-2xl border border-[var(--to-border)] bg-[var(--to-surface-2)] p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-[var(--to-ink)]">Job Detail</h3>
              <p className="mt-1 text-xs text-[var(--to-ink-muted)]">
                All job-level check-in rows for the selected week.
              </p>
            </div>

            {primaryRow.job_rows.length ? (
              <div className="overflow-x-auto rounded-xl border bg-[var(--to-surface)]">
                <table className="min-w-full border-collapse text-xs">
                  <thead className="bg-[var(--to-surface-2)]">
                    <tr>
                      <th className="border-b px-3 py-2 text-left">Day</th>
                      <th className="border-b px-3 py-2 text-left">Job #</th>
                      <th className="border-b px-3 py-2 text-left">Type</th>
                      <th className="border-b px-3 py-2 text-right">Units</th>
                      <th className="border-b px-3 py-2 text-left">Start</th>
                      <th className="border-b px-3 py-2 text-left">End</th>
                      <th className="border-b px-3 py-2 text-right">Duration</th>
                      <th className="border-b px-3 py-2 text-right">Between</th>
                      <th className="border-b px-3 py-2 text-left">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {primaryRow.job_rows.map((job, index) => {
                      const isFirstForDate =
                        index === 0 || primaryRow.job_rows[index - 1]?.shift_date !== job.shift_date;

                      return (
                        <Fragment key={`${job.shift_date}:${job.job_num}:${job.start_time ?? index}`}>
                          {isFirstForDate ? (
                            <tr key={`${job.shift_date}:divider`}>
                              <td colSpan={9} className="bg-[var(--to-surface-2)] px-3 py-2">
                                <div className="flex items-center gap-3">
                                  <div className="h-px flex-1 bg-[var(--to-border)]" />
                                  <div className="rounded-full border border-[var(--to-border)] bg-[var(--to-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
                                    {formatWorkedDate(job.shift_date)}
                                  </div>
                                  <div className="h-px flex-1 bg-[var(--to-border)]" />
                                </div>
                              </td>
                            </tr>
                          ) : null}

                          <tr key={`${job.shift_date}:${job.job_num}:${job.start_time ?? ""}`}>
                            <td className="border-b px-3 py-2 font-medium">
                              {formatWorkedDate(job.shift_date)}
                            </td>
                            <td className="border-b px-3 py-2">{job.job_num}</td>
                            <td className="border-b px-3 py-2">{job.job_type ?? "—"}</td>
                            <td className="border-b px-3 py-2 text-right">{formatDecimal(job.job_units)}</td>
                            <td className="border-b px-3 py-2">{job.start_time ?? "—"}</td>
                            <td className="border-b px-3 py-2">{job.cp_time ?? "—"}</td>
                            <td className="border-b px-3 py-2 text-right">
                              {formatHoursMinutes(job.job_duration)}
                            </td>
                            <td className="border-b px-3 py-2 text-right">
                              {job.between_job_minutes === null ? "—" : `${job.between_job_minutes} min`}
                            </td>
                            <td className="border-b px-3 py-2">{jobSignal(job)}</td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[var(--to-ink-muted)]">No job detail rows found for this week.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--to-ink-muted)]">No check-in weeks found for this window.</p>
      )}
    </section>
  );
}