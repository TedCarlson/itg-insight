"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

type Day = {
  date: string;
  quota_hours: number | null;
  quota_routes: number | null;
  quota_units?: number | null;
  scheduled_routes: number;
  scheduled_techs: number;
  planned_field_count?: number | null;
  planned_travel_count?: number | null;
  total_headcount: number;
  util_pct: number | null;
  delta_forecast: number | null;
  has_sv: boolean;
  has_check_in: boolean;
  actual_techs?: number | null;
  actual_units?: number | null;
  actual_hours?: number | null;
  actual_jobs?: number | null;
  work_count?: number | null;
  bplow_count?: number | null;
  prjt_count?: number | null;
  trvl_count?: number | null;
  bptrl_count?: number | null;
};

type UnitMode = "routes" | "hours" | "units";
type DayState = "planned" | "built" | "actual";
type Verdict = "MEETS" | "MISSES" | "MET" | "MISSED" | "NA";

const POINTS_PER_ROUTE = 96;

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function sundayForISO(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

function previousCompletedSunday(todayIso: string): string {
  return addDaysISO(sundayForISO(todayIso), -7);
}

function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
}

function mmdd(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
}

function n(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function count(v: unknown): number {
  return n(v) ?? 0;
}

function fmtWhole(v: number | null): string {
  if (v === null) return "—";
  return String(Math.round(v));
}

function fmtSigned(v: number | null): string {
  if (v === null) return "—";
  const rounded = Math.round(v * 10) / 10;
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function pct(num: number, den: number): string {
  if (!den) return "—";
  const p = (num / den) * 100;
  if (!Number.isFinite(p)) return "—";
  return `${Math.round(p * 10) / 10}%`;
}

function fmt(mode: UnitMode, routes: number | null, hours: number | null, units: number | null): string {
  if (mode === "routes") return routes === null ? "—" : String(Math.round(routes));
  if (mode === "hours") return hours === null ? "—" : String(Math.round(hours * 10) / 10);
  return units === null ? "—" : String(Math.round(units));
}

function stateForDay(d: Day): DayState {
  if (d.has_check_in) return "actual";
  if (d.has_sv) return "built";
  return "planned";
}

function stateLabel(state: DayState): string {
  if (state === "actual") return "Actual";
  if (state === "built") return "Built";
  return "Planned";
}

function quotaPointsForDay(d: Day): number | null {
  return n(d.quota_units) ?? (n(d.quota_hours) === null ? null : count(d.quota_hours) * 12);
}

function isNearRoutes(lockEligible: number | null, quotaRoutes: number | null): boolean {
  if (lockEligible === null || quotaRoutes === null || quotaRoutes <= 0) return false;
  return lockEligible < quotaRoutes && lockEligible >= quotaRoutes * 0.9;
}

function computeVerdict(args: {
  state: DayState;
  lockEligible: number | null;
  quotaRoutes: number | null;
  phasePoints: number | null;
  quotaPoints: number | null;
}): Verdict {
  const { state, lockEligible, quotaRoutes, phasePoints, quotaPoints } = args;

  if (quotaRoutes === null || lockEligible === null) return "NA";

  const success =
    lockEligible >= quotaRoutes ||
    (isNearRoutes(lockEligible, quotaRoutes) &&
      quotaPoints !== null &&
      phasePoints !== null &&
      phasePoints >= quotaPoints);

  if (state === "actual") return success ? "MET" : "MISSED";
  return success ? "MEETS" : "MISSES";
}

function isMiss(verdict: Verdict): boolean {
  return verdict === "MISSES" || verdict === "MISSED";
}

function incentiveCapture(misses: number): number {
  return Math.max(0, 100 - Math.min(4, misses) * 25);
}

function chipClass(verdict: Verdict) {
  if (isMiss(verdict)) return "border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.14)]";
  if (verdict === "NA") return "border-[var(--to-border)] bg-[var(--to-surface-2)]";
  return "border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.12)]";
}

function buildRow(d: Day) {
  const state = stateForDay(d);

  const work = count(d.work_count);
  const bplow = count(d.bplow_count);
  const prjt = count(d.prjt_count);
  const trvl = count(d.trvl_count);
  const bptrl = count(d.bptrl_count);

  const quotaRoutes = n(d.quota_routes);
  const quotaHours = n(d.quota_hours);
  const quotaPoints = quotaPointsForDay(d);

  const plannedEligible = count(d.planned_field_count ?? d.scheduled_routes);
  const plannedIneligible = count(d.planned_travel_count);
  const plannedRun = plannedEligible + plannedIneligible;

  const builtEligible = work + bplow + prjt;
  const builtIneligible = trvl + bptrl;
  const builtRun = work + bplow + prjt + trvl + bptrl;

  const actualTechs = n(d.actual_techs);
  const actualEligible =
    actualTechs === null ? null : actualTechs - trvl - bptrl + bplow + prjt;
  const actualIneligible = actualTechs === null ? null : trvl + bptrl;
  const actualRun = actualTechs === null ? null : actualTechs + bplow + prjt;

  const eligible =
    state === "actual" ? actualEligible : state === "built" ? builtEligible : plannedEligible;
  const ineligible =
    state === "actual" ? actualIneligible : state === "built" ? builtIneligible : plannedIneligible;
  const totalRun = state === "actual" ? actualRun : state === "built" ? builtRun : plannedRun;

  const phasePoints =
    state === "actual" || state === "built"
      ? n(d.actual_units)
      : eligible === null
        ? null
        : eligible * POINTS_PER_ROUTE;

  const routeDelta = quotaRoutes === null || eligible === null ? null : eligible - quotaRoutes;
  const pointDelta = quotaPoints === null || phasePoints === null ? null : phasePoints - quotaPoints;

  const verdict = computeVerdict({
    state,
    lockEligible: eligible,
    quotaRoutes,
    phasePoints,
    quotaPoints,
  });

  return {
    day: d,
    state,
    work,
    bplow,
    prjt,
    trvl,
    bptrl,
    quotaRoutes,
    quotaHours,
    quotaPoints,
    eligible,
    ineligible,
    totalRun,
    phasePoints,
    routeDelta,
    pointDelta,
    verdict,
  };
}

type Row = ReturnType<typeof buildRow>;

function summarize(rows: Row[]) {
  const acc = {
    eligibleRoutes: 0,
    totalRoutes: 0,
    ineligibleRoutes: 0,
    quotaRoutes: 0,
    eligiblePoints: 0,
    quotaPoints: 0,
    headcountDays: 0,
    scheduledTechDays: 0,
    scheduledRoutes: 0,
    svDays: 0,
    ciDays: 0,
    misses: 0,
    naDays: 0,
  };

  for (const r of rows) {
    acc.eligibleRoutes += count(r.eligible);
    acc.totalRoutes += count(r.totalRun);
    acc.ineligibleRoutes += count(r.ineligible);
    acc.quotaRoutes += count(r.quotaRoutes);
    acc.eligiblePoints += count(r.phasePoints);
    acc.quotaPoints += count(r.quotaPoints);
    acc.headcountDays += count(r.day.total_headcount);
    acc.scheduledTechDays += count(r.day.scheduled_techs);
    acc.scheduledRoutes += count(r.day.scheduled_routes);
    acc.svDays += r.day.has_sv ? 1 : 0;
    acc.ciDays += r.day.has_check_in ? 1 : 0;
    acc.misses += isMiss(r.verdict) ? 1 : 0;
    acc.naDays += r.verdict === "NA" ? 1 : 0;
  }

  return acc;
}

function MetricCard(props: {
  label: string;
  value: string;
  note?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--to-border)] bg-[var(--to-surface-2)] p-3">
      <div className="text-xs text-[var(--to-ink-muted)]">{props.label}</div>
      <div
        className={[
          "mt-1 text-sm font-semibold tabular-nums",
          props.danger ? "text-[rgba(239,68,68,0.95)]" : "",
        ].join(" ")}
      >
        {props.value}
      </div>
      {props.note ? <div className="mt-1 text-[10px] text-[var(--to-ink-muted)]">{props.note}</div> : null}
    </div>
  );
}

function MiniStat(props: { label: string; value: string; note?: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--to-border)] bg-[var(--to-surface)] p-3">
      <div className="text-[11px] text-[var(--to-ink-muted)]">{props.label}</div>
      <div
        className={[
          "mt-1 text-sm font-semibold tabular-nums",
          props.danger ? "text-[rgba(239,68,68,0.95)]" : "",
        ].join(" ")}
      >
        {props.value}
      </div>
      {props.note ? <div className="mt-1 text-[10px] text-[var(--to-ink-muted)]">{props.note}</div> : null}
    </div>
  );
}

export function RouteLockSevenDayClient(props: { days: Day[]; todayIso: string }) {
  const days = useMemo(() => props.days ?? [], [props.days]);
  const [weekStart, setWeekStart] = useState(() => previousCompletedSunday(props.todayIso));

  const weekEnd = addDaysISO(weekStart, 6);

  const fiscalRows = useMemo(() => days.map(buildRow), [days]);
  const weeklyRows = useMemo(
    () => fiscalRows.filter((r) => r.day.date >= weekStart && r.day.date <= weekEnd),
    [fiscalRows, weekStart, weekEnd]
  );

  const fiscalTotals = useMemo(() => summarize(fiscalRows), [fiscalRows]);
  const weekTotals = useMemo(() => summarize(weeklyRows), [weeklyRows]);

  const fiscalCapture = incentiveCapture(fiscalTotals.misses);
  const weeklyCapture = incentiveCapture(weekTotals.misses);

  const fiscalRouteDelta = fiscalTotals.eligibleRoutes - fiscalTotals.quotaRoutes;
  const fiscalPointDelta = fiscalTotals.eligiblePoints - fiscalTotals.quotaPoints;
  const weekRouteDelta = weekTotals.eligibleRoutes - weekTotals.quotaRoutes;
  const weekPointDelta = weekTotals.eligiblePoints - weekTotals.quotaPoints;

  const failingDays = useMemo(
    () =>
      fiscalRows
        .filter((r) => isMiss(r.verdict))
        .sort((a, b) => a.day.date.localeCompare(b.day.date)),
    [fiscalRows]
  );

  const currentWeekStart = sundayForISO(props.todayIso);
  const weeklyUtil = pct(weekTotals.scheduledTechDays, weekTotals.headcountDays);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Fiscal Month • Route Lock Executive Summary</div>
            <div className="text-xs text-[var(--to-ink-muted)]">
              Big-picture lock risk, failing days, and incentive capture impact.
            </div>
          </div>

        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <MetricCard label="Month Misses" value={`${fiscalTotals.misses} / 4`} danger={fiscalTotals.misses > 0} />
          <MetricCard label="Incentive Capture" value={`${fiscalCapture}%`} danger={fiscalCapture < 100} />
          <MetricCard label="Eligible Net" value={`Routes ${fmtSigned(fiscalRouteDelta)}`} note={`Points ${fmtSigned(fiscalPointDelta)}`} danger={fiscalRouteDelta < 0} />
          <MetricCard label="Eligible / Quota" value={`${fiscalTotals.eligibleRoutes} / ${fiscalTotals.quotaRoutes}`} note={`${pct(fiscalTotals.eligibleRoutes, fiscalTotals.quotaRoutes)} lock coverage`} />
          <MetricCard label="Total Run" value={String(fiscalTotals.totalRoutes)} note={`${fiscalTotals.ineligibleRoutes} ineligible`} />
          <MetricCard label="Evidence" value={`SV ${fiscalTotals.svDays}/${fiscalRows.length}`} note={`CI ${fiscalTotals.ciDays}/${fiscalRows.length}`} />
        </div>

        <div className="mt-4 rounded-xl border border-[var(--to-border)] bg-[var(--to-surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Failing Days</div>
              <div className="text-xs text-[var(--to-ink-muted)]">
                Days missing lock by eligible routes and points.
              </div>
            </div>
            <div className="text-xs text-[var(--to-ink-muted)]">{failingDays.length} day(s)</div>
          </div>

          {!failingDays.length ? (
            <div className="mt-3 text-sm text-[var(--to-ink-muted)]">No failing days in the fiscal month view.</div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[760px] w-full text-xs">
                <thead className="text-[var(--to-ink-muted)]">
                  <tr className="border-b border-[var(--to-border)]">
                    <th className="py-2 text-left">Date</th>
                    <th className="py-2 text-left">Phase</th>
                    <th className="py-2 text-right">Quota</th>
                    <th className="py-2 text-right">Eligible</th>
                    <th className="py-2 text-right">Route Gap</th>
                    <th className="py-2 text-right">Point Gap</th>
                    <th className="py-2 text-right">Scheduled</th>
                    <th className="py-2 text-right">Total Run</th>
                  </tr>
                </thead>
                <tbody>
                  {failingDays.slice(0, 12).map((r) => (
                    <tr key={r.day.date} className="border-b border-[var(--to-border)] last:border-0">
                      <td className="py-2 font-medium tabular-nums">
                        {r.day.date} <span className="text-[var(--to-ink-muted)]">{weekdayShort(r.day.date)}</span>
                      </td>
                      <td className="py-2">{stateLabel(r.state)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt("routes", r.quotaRoutes, null, null)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt("routes", r.eligible, null, null)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums text-[rgba(239,68,68,0.95)]">
                        {fmtSigned(r.routeDelta)}
                      </td>
                      <td className="py-2 text-right tabular-nums">{fmtSigned(r.pointDelta)}</td>
                      <td className="py-2 text-right tabular-nums">{r.day.scheduled_routes}</td>
                      <td className="py-2 text-right tabular-nums">{fmt("routes", r.totalRun, null, null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-semibold">Weekly Detail • Route Lock Snapshot</div>
            <div className="text-xs text-[var(--to-ink-muted)]">
              Sunday–Saturday detail view with enough context to move directly into action planning.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="to-btn to-btn--secondary h-8 px-3 text-xs" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>
              Previous Week
            </button>
            <button type="button" className="to-btn to-btn--secondary h-8 px-3 text-xs" onClick={() => setWeekStart(previousCompletedSunday(props.todayIso))}>
              Previous Completed
            </button>
            <button type="button" className="to-btn to-btn--secondary h-8 px-3 text-xs" onClick={() => setWeekStart(currentWeekStart)}>
              Current Week
            </button>
            <button type="button" className="to-btn to-btn--secondary h-8 px-3 text-xs" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>
              Next Week
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Week" value={`${weekStart} → ${weekEnd}`} />
          <MiniStat label="Incentive Capture" value={`${weeklyCapture}%`} note={`${weekTotals.misses} miss(es) / 4`} danger={weeklyCapture < 100} />
          <MiniStat label="Eligible Route Net" value={fmtSigned(weekRouteDelta)} note={`${weekTotals.eligibleRoutes} eligible / ${weekTotals.quotaRoutes} quota`} danger={weekRouteDelta < 0} />
          <MiniStat label="Eligible Point Net" value={fmtSigned(weekPointDelta)} note={`${fmtWhole(weekTotals.eligiblePoints)} / ${fmtWhole(weekTotals.quotaPoints)}`} danger={weekPointDelta < 0} />
          <MiniStat label="Evidence" value={`SV ${weekTotals.svDays}/${weeklyRows.length}`} note={`CI ${weekTotals.ciDays}/${weeklyRows.length} • Util ${weeklyUtil}`} />
        </div>

        {!weeklyRows.length ? (
          <div className="mt-4 rounded-xl border border-[var(--to-border)] bg-[var(--to-surface-2)] p-4 text-sm text-[var(--to-ink-muted)]">
            No days available for this selected week.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-7">
            {weeklyRows.map((r) => {
              const d = r.day;
              const hc = d.total_headcount ? `${d.scheduled_techs}/${d.total_headcount}` : `${d.scheduled_techs}/—`;
              const util = d.util_pct === null ? "—" : `${d.util_pct}%`;

              return (
                <div key={d.date} className="rounded-2xl border border-[var(--to-border)] bg-[var(--to-surface)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className={["rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums", chipClass(r.verdict)].join(" ")}>
                      {mmdd(d.date)} <span className="font-normal text-[var(--to-ink-muted)]">{weekdayShort(d.date)}</span>
                    </div>
                    <div className="flex gap-1 text-[10px]">
                      <span className="rounded border border-[var(--to-border)] px-1.5 py-0.5">{stateLabel(r.state)}</span>
                      {d.has_sv ? <span className="rounded border border-[var(--to-border)] px-1.5 py-0.5">V</span> : null}
                      {d.has_check_in ? <span className="rounded border border-[var(--to-border)] px-1.5 py-0.5">C</span> : null}
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">Lock</div>
                      <div className="grid grid-cols-2 gap-y-1 text-xs tabular-nums">
                        <div className="text-[var(--to-ink-muted)]">Quota</div>
                        <div className="text-right">{fmtWhole(r.quotaRoutes)}</div>
                        <div className="text-[var(--to-ink-muted)]">Eligible</div>
                        <div className="text-right font-semibold">{fmtWhole(r.eligible)}</div>
                        <div className="text-[var(--to-ink-muted)]">Route Net</div>
                        <div className="text-right font-semibold">{fmtSigned(r.routeDelta)}</div>
                        <div className="text-[var(--to-ink-muted)]">Point Net</div>
                        <div className="text-right">{fmtSigned(r.pointDelta)}</div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">Operational Detail</div>
                      <div className="grid grid-cols-2 gap-y-1 text-xs tabular-nums">
                        <div className="text-[var(--to-ink-muted)]">Scheduled</div>
                        <div className="text-right">{d.scheduled_routes}</div>
                        <div className="text-[var(--to-ink-muted)]">Total Run</div>
                        <div className="text-right">{fmtWhole(r.totalRun)}</div>
                        <div className="text-[var(--to-ink-muted)]">Ineligible</div>
                        <div className="text-right">{fmtWhole(r.ineligible)}</div>
                        <div className="text-[var(--to-ink-muted)]">Call-outs</div>
                        <div className="text-right text-[var(--to-ink-muted)]">—</div>
                        <div className="text-[var(--to-ink-muted)]">Add-ins</div>
                        <div className="text-right text-[var(--to-ink-muted)]">—</div>
                        <div className="text-[var(--to-ink-muted)]">HC</div>
                        <div className="text-right">
                          {hc} <span className="text-[var(--to-ink-muted)]">({util})</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--to-border)] bg-[var(--to-surface-2)] p-2">
                      <div className="grid grid-cols-5 gap-1 text-[10px] tabular-nums">
                        <div><div className="text-[var(--to-ink-muted)]">WORK</div><div className="font-semibold">{r.work}</div></div>
                        <div><div className="text-[var(--to-ink-muted)]">BPLOW</div><div className="font-semibold">{r.bplow}</div></div>
                        <div><div className="text-[var(--to-ink-muted)]">PRJT</div><div className="font-semibold">{r.prjt}</div></div>
                        <div><div className="text-[var(--to-ink-muted)]">TRVL</div><div className="font-semibold">{r.trvl}</div></div>
                        <div><div className="text-[var(--to-ink-muted)]">BPTRL</div><div className="font-semibold">{r.bptrl}</div></div>
                      </div>
                    </div>

                    <div
                      className={[
                        "text-[10px] font-semibold",
                        isMiss(r.verdict) ? "text-[rgba(239,68,68,0.95)]" : "text-[rgba(16,185,129,0.95)]",
                      ].join(" ")}
                    >
                      {r.verdict === "NA" ? "—" : r.verdict}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-[11px] text-[var(--to-ink-muted)]">
          Incentive signal: each miss reduces capture-able incentive by 25%. Four or more misses equals 0%.
        </div>
      </Card>
    </div>
  );
}