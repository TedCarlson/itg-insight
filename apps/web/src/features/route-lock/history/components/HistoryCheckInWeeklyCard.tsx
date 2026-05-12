// path: apps/web/src/features/route-lock/history/components/HistoryCheckInWeeklyCard.tsx

"use client";

import { useState } from "react";
import type { CheckInDayResponse, CheckInWeeklyRow } from "../lib/history.types";

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

function getSlaJobsForDate(row: CheckInWeeklyRow, date: string) {
  return row.worked_date_details?.find((item) => item.shift_date === date)?.sla_bptrl_jobs ?? 0;
}

function detailKey(row: CheckInWeeklyRow, date: string) {
  return `${row.assignment_id}:${date}`;
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

function sumBetweenMinutes(detail: CheckInDayResponse) {
  return detail.rows.reduce((sum, row) => {
    return sum + (row.between_job_minutes ?? 0);
  }, 0);
}

export default function HistoryCheckInWeeklyCard(props: {
  rows: CheckInWeeklyRow[];
  loading: boolean;
  error: string | null;
}) {
  const { rows, loading, error } = props;

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CheckInDayResponse | null>(null);

  async function openDate(row: CheckInWeeklyRow, date: string) {
    const key = detailKey(row, date);

    if (openKey === key) {
      setOpenKey(null);
      setDetail(null);
      setDetailError(null);
      setDetailBusy(false);
      return;
    }

    if (!row.assignment_id || row.assignment_id === "undefined") {
      setOpenKey(key);
      setDetail(null);
      setDetailBusy(false);
      setDetailError("Missing assignment id for this weekly row.");
      return;
    }

    setOpenKey(key);
    setDetailBusy(true);
    setDetailError(null);
    setDetail(null);

    try {
      const params = new URLSearchParams({
        assignment_id: row.assignment_id,
        shift_date: date,
      });

      const res = await fetch(`/api/route-lock/history/check-in-day?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(String(json?.error ?? "Failed to load daily detail"));
      }

      setDetail(json as CheckInDayResponse);
    } catch (err: any) {
      setDetail(null);
      setDetailError(String(err?.message ?? "Failed to load daily detail"));
    } finally {
      setDetailBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-[var(--to-surface)] p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
          Weekly Check-In Summary
        </h2>
        <p className="text-xs text-[var(--to-ink-muted)]">
          Sunday to Saturday grouped actuals with productivity rates and SLA/BPTRL trial markers.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--to-ink-muted)]">Loading check-in weekly summary…</p>
      ) : error ? (
        <p className="text-sm text-[var(--to-danger,#b91c1c)]">{error}</p>
      ) : rows.length ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-[var(--to-border)]">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[var(--to-surface-2)]">
                <tr>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-left font-semibold text-[var(--to-ink)]">
                    Week
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-left font-semibold text-[var(--to-ink)]">
                    Week Ending
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-left font-semibold text-[var(--to-ink)]">
                    Tech
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-left font-semibold text-[var(--to-ink)]">
                    Affiliation
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-center font-semibold text-[var(--to-ink)]">
                    Days
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-left font-semibold text-[var(--to-ink)]">
                    Worked Dates
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-right font-semibold text-[var(--to-ink)]">
                    Jobs
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-right font-semibold text-[var(--to-ink)]">
                    Jobs/Day
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-right font-semibold text-[var(--to-ink)]">
                    Units
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-right font-semibold text-[var(--to-ink)]">
                    Units/Day
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-right font-semibold text-[var(--to-ink)]">
                    Hours
                  </th>
                  <th className="border-b border-[var(--to-border)] px-3 py-2 text-right font-semibold text-[var(--to-ink)]">
                    Hours/Day
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
                {rows.map((row) => (
                  <tr key={`${row.week_start}:${row.week_end}:${row.tech_id}`}>
                    <td className="border-b border-[var(--to-border)] px-3 py-2 text-[var(--to-ink)]">
                      <div className="font-medium">{formatWeekLabel(row)}</div>
                      <div className="text-xs text-[var(--to-ink-muted)]">{row.week_start}</div>
                    </td>

                    <td className="border-b border-[var(--to-border)] px-3 py-2">
                      {row.week_ending_saturday || row.week_end}
                    </td>

                    <td className="border-b border-[var(--to-border)] px-3 py-2">
                      <div className="font-medium">{row.full_name}</div>
                      <div className="text-xs text-[var(--to-ink-muted)]">{row.tech_id}</div>
                    </td>

                    <td className="border-b border-[var(--to-border)] px-3 py-2 text-[var(--to-ink-muted)]">
                      {row.affiliation ?? "—"}
                    </td>

                    <td className="border-b border-[var(--to-border)] px-3 py-2 text-center">
                      {row.days_worked}
                    </td>

                    <td className="border-b border-[var(--to-border)] px-3 py-2">
                      <div className="flex min-w-52 flex-wrap gap-1">
                        {row.worked_dates.map((date) => {
                          const slaJobs = getSlaJobsForDate(row, date);
                          const isSla = slaJobs > 0;
                          const isOpen = openKey === detailKey(row, date);

                          return (
                            <button
                              key={`${row.week_start}:${row.tech_id}:${date}`}
                              type="button"
                              onClick={() => openDate(row, date)}
                              title={isSla ? `${slaJobs} SLA/BPTRL job(s)` : "BAU day"}
                              className={
                                isSla
                                  ? `rounded-full border px-2 py-0.5 text-xs font-medium ${isOpen
                                    ? "border-amber-700 bg-amber-200 text-amber-950"
                                    : "border-amber-300 bg-amber-100 text-amber-900"
                                  }`
                                  : `rounded-full border px-2 py-0.5 text-xs ${isOpen
                                    ? "border-[var(--to-ink)] bg-[var(--to-surface-2)] text-[var(--to-ink)]"
                                    : "border-[var(--to-border)] bg-[var(--to-surface)] text-[var(--to-ink-muted)]"
                                  }`
                              }
                            >
                              {formatWorkedDate(date)}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                      {formatNumber(row.actual_jobs)}
                    </td>
                    <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                      {formatDecimal(row.jobs_per_day)}
                    </td>
                    <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                      {formatNumber(row.actual_units)}
                    </td>
                    <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                      {formatDecimal(row.units_per_day)}
                    </td>
                    <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                      {formatDecimal(row.actual_hours)}
                    </td>
                    <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                      {formatDecimal(row.hours_per_day)}
                    </td>
                    <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                      {formatDecimal(row.units_per_hour)}
                    </td>
                    <td className="border-b border-[var(--to-border)] px-3 py-2 text-right">
                      {row.sla_bptrl_jobs > 0 ? (
                        <div>
                          <div className="font-medium">{formatNumber(row.sla_bptrl_jobs)}</div>
                          <div className="text-xs text-[var(--to-ink-muted)]">
                            {formatDecimal(row.sla_bptrl_units)} units
                          </div>
                        </div>
                      ) : (
                        <span className="text-[var(--to-ink-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {openKey ? (
            <div className="rounded-2xl border border-[var(--to-border)] bg-[var(--to-surface-2)] p-4">
              {detailBusy ? (
                <p className="text-sm text-[var(--to-ink-muted)]">Loading daily job detail…</p>
              ) : detailError ? (
                <p className="text-sm text-[var(--to-danger,#b91c1c)]">{detailError}</p>
              ) : detail ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--to-ink)]">
                      Daily Job Detail — {formatWorkedDate(detail.shift_date)}
                    </h3>
                    <p className="text-xs text-[var(--to-ink-muted)]">
                      Selected day job detail with SLA marker and estimated between-job time.
                    </p>
                  </div>

                  <div className="grid gap-2 md:grid-cols-7">
                    <div className="rounded-xl border bg-[var(--to-surface)] p-3">
                      <div className="text-xs text-[var(--to-ink-muted)]">Jobs</div>
                      <div className="font-semibold">{detail.summary.total_jobs}</div>
                    </div>
                    <div className="rounded-xl border bg-[var(--to-surface)] p-3">
                      <div className="text-xs text-[var(--to-ink-muted)]">Units</div>
                      <div className="font-semibold">{formatDecimal(detail.summary.total_units)}</div>
                    </div>
                    <div className="rounded-xl border bg-[var(--to-surface)] p-3">
                      <div className="text-xs text-[var(--to-ink-muted)]">Hours</div>
                      <div className="font-semibold">{formatDecimal(detail.summary.total_hours)}</div>
                    </div>
                    <div className="rounded-xl border bg-[var(--to-surface)] p-3">
                      <div className="text-xs text-[var(--to-ink-muted)]">SLA Jobs</div>
                      <div className="font-semibold">{detail.summary.sla_jobs}</div>
                    </div>
                    <div className="rounded-xl border bg-[var(--to-surface)] p-3">
                      <div className="text-xs text-[var(--to-ink-muted)]">Avg Units/Job</div>
                      <div className="font-semibold">{formatDecimal(detail.summary.avg_units_per_job)}</div>
                    </div>
                    <div className="rounded-xl border bg-[var(--to-surface)] p-3">
                      <div className="text-xs text-[var(--to-ink-muted)]">Avg Between</div>
                      <div className="font-semibold">
                        {detail.summary.avg_minutes_between_jobs === null
                          ? "—"
                          : `${formatDecimal(detail.summary.avg_minutes_between_jobs)} min`}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-[var(--to-surface)] p-3">
                      <div className="text-xs text-[var(--to-ink-muted)]">Non Prod Time</div>
                      <div className="font-semibold">
                        {sumBetweenMinutes(detail) > 0 ? `${sumBetweenMinutes(detail)} min` : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border bg-[var(--to-surface)]">
                    <table className="min-w-full border-collapse text-xs">
                      <thead className="bg-[var(--to-surface-2)]">
                        <tr>
                          <th className="border-b px-3 py-2 text-left">Job #</th>
                          <th className="border-b px-3 py-2 text-left">Type</th>
                          <th className="border-b px-3 py-2 text-right">Units</th>
                          <th className="border-b px-3 py-2 text-left">Start</th>
                          <th className="border-b px-3 py-2 text-left">End</th>
                          <th className="border-b px-3 py-2 text-right">Duration</th>
                          <th className="border-b px-3 py-2 text-right">Between</th>
                          <th className="border-b px-3 py-2 text-left">SLA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.rows.map((job) => (
                          <tr key={`${job.job_num}:${job.start_time ?? ""}`}>
                            <td className="border-b px-3 py-2">{job.job_num}</td>
                            <td className="border-b px-3 py-2">{job.job_type ?? "—"}</td>
                            <td className="border-b px-3 py-2 text-right">{formatDecimal(job.job_units)}</td>
                            <td className="border-b px-3 py-2">{job.start_time ?? "—"}</td>
                            <td className="border-b px-3 py-2">{job.cp_time ?? "—"}</td>
                            <td className="border-b px-3 py-2 text-right">{formatHoursMinutes(job.job_duration)}</td>
                            <td className="border-b px-3 py-2 text-right">
                              {job.between_job_minutes === null ? "—" : `${job.between_job_minutes} min`}
                            </td>
                            <td className="border-b px-3 py-2">
                              {job.is_sla_bptrl ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">SLA</span>
                              ) : (
                                <span className="text-[var(--to-ink-muted)]">BAU</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--to-ink-muted)]">No check-in weeks found for this window.</p>
      )}
    </section>
  );
}