// path: apps/web/src/features/route-lock/calendar/RouteLockCalendarClient.tsx

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

type Fiscal = { start_date: string; end_date: string; label?: string | null };

type Day = {
  date: string;
  quota_hours: number | null;
  quota_routes: number | null;
  quota_units: number | null;

  scheduled_routes: number;
  scheduled_techs: number;
  planned_field_count?: number | null;
  planned_travel_count?: number | null;

  total_headcount: number;
  util_pct: number | null;
  delta_forecast: number | null;

  has_sv: boolean;
  has_check_in: boolean;

  actual_techs: number | null;
  actual_units: number | null;
  actual_hours: number | null;
  actual_jobs: number | null;

  work_count?: number | null;
  bplow_count?: number | null;
  prjt_count?: number | null;
  trvl_count?: number | null;
  bptrl_count?: number | null;
};

type DayState = "planned" | "built" | "actual";
type LockVerdict = "MEETS" | "MISSES" | "MET" | "MISSED" | "NA";
type NetTone = "met" | "near" | "miss" | "muted";

const POINTS_PER_ROUTE = 96;

function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
}

function isWeekStart(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.getUTCDay() === 0;
}

function n(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function count(v: unknown): number {
  return n(v) ?? 0;
}

function fmt(v: number | null): string {
  if (v === null) return "—";
  return String(Math.round(v * 10) / 10);
}

function fmtWhole(v: number | null): string {
  if (v === null) return "—";
  return String(Math.round(v));
}

function fmtDelta(v: number | null): string {
  if (v === null) return "—";
  const rounded = Math.round(v * 10) / 10;
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${Math.round(v * 10) / 10}%`;
}

function safePct(num: number | null, den: number | null): number | null {
  if (num === null || !den) return null;
  const p = (num / den) * 100;
  if (!Number.isFinite(p)) return null;
  return Math.round(p * 10) / 10;
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

function valueLabel(state: DayState): string {
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

function routeNetTone(lockEligible: number | null, quotaRoutes: number | null): NetTone {
  if (lockEligible === null || quotaRoutes === null) return "muted";
  if (lockEligible >= quotaRoutes) return "met";
  if (isNearRoutes(lockEligible, quotaRoutes)) return "near";
  return "miss";
}

function pointNetTone(args: {
  lockEligible: number | null;
  quotaRoutes: number | null;
  phasePoints: number | null;
  quotaPoints: number | null;
}): NetTone {
  const { lockEligible, quotaRoutes, phasePoints, quotaPoints } = args;

  if (phasePoints === null || quotaPoints === null) return "muted";
  if (phasePoints >= quotaPoints && isNearRoutes(lockEligible, quotaRoutes)) return "met";
  if (phasePoints >= quotaPoints) return "near";
  return "miss";
}

function netToneClass(tone: NetTone): string {
  if (tone === "met") return "text-[rgba(16,185,129,0.95)]";
  if (tone === "near") return "text-[rgba(245,158,11,0.95)]";
  if (tone === "miss") return "text-[rgba(239,68,68,0.95)]";
  return "text-[var(--to-ink-muted)]";
}

function verdictTone(verdict: LockVerdict) {
  if (verdict === "MEETS" || verdict === "MET") return "text-[rgba(16,185,129,0.95)]";
  if (verdict === "MISSES" || verdict === "MISSED") return "text-[rgba(239,68,68,0.95)]";
  return "text-[var(--to-ink-muted)]";
}

function computeVerdict(args: {
  state: DayState;
  lockEligible: number | null;
  quotaRoutes: number | null;
  phasePoints: number | null;
  quotaPoints: number | null;
}): LockVerdict {
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

export function RouteLockCalendarClient(props: {
  fiscal: Fiscal;
  days: Day[];
  todayIso: string;
  prevHref?: string | null;
  currentHref?: string | null;
  nextHref?: string | null;
}) {
  const [showBreakout, setShowBreakout] = useState(false);

  const fiscalLabel =
    props.fiscal.label ?? `Fiscal ${props.fiscal.start_date} → ${props.fiscal.end_date}`;

  const rows = useMemo(() => {
    return props.days.map((d) => {
      const state = stateForDay(d);

      const work = count(d.work_count);
      const bplow = count(d.bplow_count);
      const prjt = count(d.prjt_count);
      const trvl = count(d.trvl_count);
      const bptrl = count(d.bptrl_count);

      const quotaRoutes = n(d.quota_routes);
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

      const lockEligible =
        state === "actual" ? actualEligible : state === "built" ? builtEligible : plannedEligible;

      const lockIneligible =
        state === "actual"
          ? actualIneligible
          : state === "built"
            ? builtIneligible
            : plannedIneligible;

      const totalRun = state === "actual" ? actualRun : state === "built" ? builtRun : plannedRun;

      const phasePoints =
        state === "actual" || state === "built"
          ? n(d.actual_units)
          : lockEligible === null
            ? null
            : lockEligible * POINTS_PER_ROUTE;

      const routeNet =
        quotaRoutes === null || lockEligible === null ? null : lockEligible - quotaRoutes;

      const pointsNet =
        quotaPoints === null || phasePoints === null ? null : phasePoints - quotaPoints;

      const lockRunRate = safePct(lockEligible, quotaRoutes);
      const totalRunRate = safePct(totalRun, quotaRoutes);

      const verdict = computeVerdict({
        state,
        lockEligible,
        quotaRoutes,
        phasePoints,
        quotaPoints,
      });

      return {
        day: d,
        state,

        quotaRoutes,
        lockEligible,
        lockIneligible,
        totalRun,

        quotaPoints,
        phasePoints,

        routeNet,
        pointsNet,
        routeTone: routeNetTone(lockEligible, quotaRoutes),
        pointTone: pointNetTone({
          lockEligible,
          quotaRoutes,
          phasePoints,
          quotaPoints,
        }),

        lockRunRate,
        totalRunRate,

        work,
        bplow,
        prjt,
        trvl,
        bptrl,

        verdict,
      };
    });
  }, [props.days]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Route Lock • {fiscalLabel}</div>
            <div className="text-xs text-[var(--to-ink-muted)]">
              Quota → planned schedule → built validation → actual check-in.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="to-btn to-btn--secondary h-8 px-3 text-xs"
              onClick={() => setShowBreakout((v) => !v)}
            >
              {showBreakout ? "Hide Breakout" : "Show Breakout"}
            </button>

            {props.prevHref ? (
              <Link href={props.prevHref} className="to-btn to-btn--secondary h-8 px-3 text-xs">
                Previous
              </Link>
            ) : null}

            {props.currentHref ? (
              <Link href={props.currentHref} className="to-btn to-btn--secondary h-8 px-3 text-xs">
                Current
              </Link>
            ) : null}

            {props.nextHref ? (
              <Link href={props.nextHref} className="to-btn to-btn--secondary h-8 px-3 text-xs">
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[620px] overflow-y-auto">
            <table
              className={[
                "table-fixed border-collapse text-sm",
                showBreakout ? "min-w-[1560px]" : "min-w-[1120px]",
              ].join(" ")}
            >
              <thead className="sticky top-0 z-10 bg-background text-xs text-[var(--to-ink-muted)] shadow-sm">
                <tr>
                  <th rowSpan={2} className="w-[150px] border-b border-r border-[var(--to-border)] bg-background px-3 py-3 text-left">
                    Date
                  </th>
                  <th rowSpan={2} className="w-[82px] border-b border-r border-[var(--to-border)] bg-background px-3 py-3 text-left">
                    Phase
                  </th>

                  <th colSpan={4} className="border-b border-r border-[var(--to-border)] bg-background px-3 py-2 text-center">
                    Routes
                  </th>

                  <th colSpan={2} className="border-b border-r border-[var(--to-border)] bg-background px-3 py-2 text-center">
                    Points
                  </th>

                  {showBreakout ? (
                    <th colSpan={5} className="border-b border-r border-[var(--to-border)] bg-background px-3 py-2 text-center">
                      Breakout
                    </th>
                  ) : null}

                  <th colSpan={2} className="border-b border-r border-[var(--to-border)] bg-background px-3 py-2 text-center">
                    Net
                  </th>

                  <th colSpan={3} className="border-b border-[var(--to-border)] bg-background px-3 py-2 text-center">
                    Solution
                  </th>
                </tr>

                <tr>
                  {[
                    ["routes-quota", "Quota", "w-[78px] text-right"],
                    ["routes-eligible", "Eligible", "w-[88px] text-right"],
                    ["routes-ineligible", "Ineligible", "w-[92px] text-right"],
                    ["routes-total-run", "Total Run", "w-[88px] text-right border-r"],
                    ["points-quota", "Quota", "w-[86px] text-right"],
                    ["points-output", "Output", "w-[86px] text-right border-r"],
                  ].map(([key, label, cls]) => (
                    <th
                      key={key}
                      className={`border-b border-[var(--to-border)] bg-background px-3 py-2 ${cls}`}
                    >
                      {label}
                    </th>
                  ))}

                  {showBreakout
                    ? [
                        ["breakout-work", "WORK", "w-[64px] text-right"],
                        ["breakout-bplow", "BPLOW", "w-[70px] text-right"],
                        ["breakout-prjt", "PRJT", "w-[64px] text-right"],
                        ["breakout-trvl", "TRVL", "w-[64px] text-right"],
                        ["breakout-bptrl", "BPTRL", "w-[72px] text-right border-r"],
                      ].map(([key, label, cls]) => (
                        <th
                          key={key}
                          className={`border-b border-[var(--to-border)] bg-background px-3 py-2 ${cls}`}
                        >
                          {label}
                        </th>
                      ))
                    : null}

                  {[
                    ["net-routes", "Routes", "w-[78px] text-right"],
                    ["net-points", "Points", "w-[78px] text-right border-r"],
                    ["solution-lock-rate", "Lock Rate", "w-[92px] text-right"],
                    ["solution-run-rate", "Run Rate", "w-[90px] text-right"],
                    ["solution-lock", "Lock", "w-[82px] text-left"],
                  ].map(([key, label, cls]) => (
                    <th
                      key={key}
                      className={`border-b border-[var(--to-border)] bg-background px-3 py-2 ${cls}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const d = row.day;
                  const isToday = d.date === props.todayIso;

                  return (
                    <tr
                      key={d.date}
                      className={[
                        "border-b hover:bg-muted/30",
                        isWeekStart(d.date) ? "border-t-2 border-t-[rgba(59,130,246,0.28)]" : "",
                        isToday ? "bg-[rgba(59,130,246,0.07)]" : "",
                      ].join(" ")}
                    >
                      <td className="border-r px-3 py-2 font-medium tabular-nums">
                        {d.date}{" "}
                        <span className="text-[var(--to-ink-muted)]">
                          {weekdayShort(d.date)}
                        </span>
                      </td>

                      <td className="border-r px-3 py-2">{stateLabel(row.state)}</td>

                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtWhole(row.quotaRoutes)}
                      </td>
                      <td
                        className={[
                          "px-3 py-2 text-right font-medium tabular-nums",
                          row.routeTone === "miss" ? "text-[rgba(239,68,68,0.95)]" : "",
                          row.routeTone === "near" ? "text-[rgba(245,158,11,0.95)]" : "",
                          row.routeTone === "met" ? "text-[rgba(16,185,129,0.95)]" : "",
                        ].join(" ")}
                      >
                        {fmt(row.lockEligible)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(row.lockIneligible)}
                      </td>
                      <td className="border-r px-3 py-2 text-right tabular-nums">
                        {fmt(row.totalRun)}
                      </td>

                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtWhole(row.quotaPoints)}
                      </td>
                      <td className="border-r px-3 py-2 text-right tabular-nums">
                        {fmtWhole(row.phasePoints)}
                      </td>

                      {showBreakout ? (
                        <>
                          <td className="px-3 py-2 text-right tabular-nums">{row.work}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.bplow}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.prjt}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.trvl}</td>
                          <td className="border-r px-3 py-2 text-right tabular-nums">
                            {row.bptrl}
                          </td>
                        </>
                      ) : null}

                      <td
                        className={[
                          "px-3 py-2 text-right font-medium tabular-nums",
                          netToneClass(row.routeTone),
                        ].join(" ")}
                      >
                        {fmtDelta(row.routeNet)}
                      </td>
                      <td
                        className={[
                          "border-r px-3 py-2 text-right font-medium tabular-nums",
                          netToneClass(row.pointTone),
                        ].join(" ")}
                      >
                        {fmtDelta(row.pointsNet)}
                      </td>

                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtPct(row.lockRunRate)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--to-ink-muted)]">
                        {fmtPct(row.totalRunRate)}
                      </td>
                      <td
                        className={[
                          "px-3 py-2 font-semibold",
                          verdictTone(row.verdict),
                        ].join(" ")}
                        title={`${valueLabel(row.state)} lock solution`}
                      >
                        {row.verdict === "NA" ? "—" : row.verdict}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}