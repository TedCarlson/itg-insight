// RUN THIS
// Replace the entire file:
// apps/web/src/features/route-lock/check-in/RollupsCardClient.tsx

"use client";

import { useMemo } from "react";

import { Card } from "@/components/ui/Card";

import type { CheckInDayFactRow } from "./ImportedRowsCardClient";

function toInt(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtInt(n: number): string {
  return n.toLocaleString();
}

function fmtNum(n: number, digits = 1): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

type DayAgg = { day: string; techs: Set<string>; jobs: number; units: number; hours: number };
type TechAgg = { tech_id: string; jobs: number; units: number; hours: number; days: Set<string> };

type DayRoll = { day: string; techs: number; jobs: number; units: number; hours: number };

export function RollupsCardClient({ rows, today }: { rows: CheckInDayFactRow[]; today: string }) {
  const roll = useMemo(() => {
    const techs = new Set<string>();
    const byDay = new Map<string, DayAgg>();
    const byTech = new Map<string, TechAgg>();

    let jobs = 0;
    let units = 0;
    let hours = 0;

    for (const r of rows) {
      techs.add(r.tech_id);

      const j = toInt(r.actual_jobs);
      const u = toNum(r.actual_units);
      const h = toNum(r.actual_hours);

      jobs += j;
      units += u;
      hours += h;

      const day = r.shift_date;
      const dayAgg = byDay.get(day) ?? { day, techs: new Set<string>(), jobs: 0, units: 0, hours: 0 };
      dayAgg.techs.add(r.tech_id);
      dayAgg.jobs += j;
      dayAgg.units += u;
      dayAgg.hours += h;
      byDay.set(day, dayAgg);

      const techAgg =
        byTech.get(r.tech_id) ?? ({ tech_id: r.tech_id, jobs: 0, units: 0, hours: 0, days: new Set<string>() } satisfies TechAgg);
      techAgg.jobs += j;
      techAgg.units += u;
      techAgg.hours += h;
      techAgg.days.add(day);
      byTech.set(r.tech_id, techAgg);
    }

    const topTechs = Array.from(byTech.values())
      .map((t) => ({ tech_id: t.tech_id, jobs: t.jobs, units: t.units, hours: t.hours, days: t.days.size }))
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 10);

    const days: DayRoll[] = Array.from(byDay.values())
      .map((d) => ({ day: d.day, techs: d.techs.size, jobs: d.jobs, units: d.units, hours: d.hours }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const todayAgg = byDay.get(today) ?? null;

    return {
      techCount: techs.size,
      rowCount: rows.length,
      jobs,
      units,
      hours,
      topTechs,
      days,
      todayAgg,
    };
  }, [rows, today]);

  return (
    <Card>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-5">Rollups</div>
        <div className="text-[11px] text-[var(--to-ink-muted)] leading-4">Window summary + daily totals</div>
      </div>

      {/* Order of importance (by day): Techs, Units, Hours, Jobs */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-[var(--to-border)] p-3">
          <div className="text-[11px] text-[var(--to-ink-muted)]">Techs</div>
          <div className="text-base font-semibold tabular-nums">{fmtInt(roll.techCount)}</div>
        </div>
        <div className="rounded-md border border-[var(--to-border)] p-3">
          <div className="text-[11px] text-[var(--to-ink-muted)]">Units</div>
          <div className="text-base font-semibold tabular-nums">{fmtNum(roll.units, 1)}</div>
        </div>
        <div className="rounded-md border border-[var(--to-border)] p-3">
          <div className="text-[11px] text-[var(--to-ink-muted)]">Hours</div>
          <div className="text-base font-semibold tabular-nums">{fmtNum(roll.hours, 1)}</div>
        </div>
        <div className="rounded-md border border-[var(--to-border)] p-3">
          <div className="text-[11px] text-[var(--to-ink-muted)]">Jobs</div>
          <div className="text-base font-semibold tabular-nums">{fmtInt(roll.jobs)}</div>
        </div>
      </div>

      {roll.todayAgg ? (
        <div className="mt-4 rounded-md border border-[var(--to-border)] bg-black/5 p-3">
          <div className="text-[11px] text-[var(--to-ink-muted)]">Today ({today})</div>
          <div className="mt-1 text-sm tabular-nums">
            {fmtInt(roll.todayAgg.techs.size)} techs · {fmtNum(roll.todayAgg.units, 1)} units · {fmtNum(roll.todayAgg.hours, 1)} hrs ·{" "}
            {fmtInt(roll.todayAgg.jobs)} jobs
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="text-[11px] text-[var(--to-ink-muted)] mb-2">Daily totals (window)</div>
        <div className="space-y-2">
          {roll.days.length === 0 ? (
            <div className="text-[11px] text-[var(--to-ink-muted)]">—</div>
          ) : (
            roll.days.slice(-14).map((d) => (
              <div key={d.day} className="flex items-center justify-between rounded-md border border-[var(--to-border)] px-3 py-2">
                <div className="font-mono text-[12px]">{d.day}</div>
                <div className="text-[11px] text-[var(--to-ink-muted)] tabular-nums">
                  {fmtInt(d.techs)} techs · {fmtNum(d.units, 1)} units · {fmtNum(d.hours, 1)} hrs · {fmtInt(d.jobs)} jobs
                </div>
              </div>
            ))
          )}
        </div>
        {roll.days.length > 14 ? <div className="mt-2 text-[11px] text-[var(--to-ink-muted)]">Showing last 14 days of daily totals.</div> : null}
      </div>

      {/* Keep the tech breakdown available, but de-emphasized */}
      <div className="mt-4">
        <div className="text-[11px] text-[var(--to-ink-muted)] mb-2">Top techs by jobs (window)</div>
        <div className="space-y-2">
          {roll.topTechs.length === 0 ? (
            <div className="text-[11px] text-[var(--to-ink-muted)]">—</div>
          ) : (
            roll.topTechs.map((t) => (
              <div key={t.tech_id} className="flex items-center justify-between rounded-md border border-[var(--to-border)] px-3 py-2">
                <div className="font-mono text-[12px]">{t.tech_id}</div>
                <div className="text-[11px] text-[var(--to-ink-muted)] tabular-nums">
                  {fmtInt(t.jobs)} jobs · {fmtNum(t.units, 1)} units · {fmtNum(t.hours, 1)} hrs · {fmtInt(t.days)} days
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* still useful for debugging */}
      <div className="mt-4 text-[11px] text-[var(--to-ink-muted)]">Rows in window: {fmtInt(roll.rowCount)}</div>
    </Card>
  );
}