// apps/web/src/features/route-lock/calendar/RouteLockCalendarClient.tsx

"use client";

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

  total_headcount: number;
  util_pct: number | null;

  delta_forecast: number | null;

  has_sv: boolean;
  has_check_in: boolean;

  actual_techs: number | null;
  actual_units: number | null;
  actual_hours: number | null;
  actual_jobs: number | null;
};

type UnitMode = "routes" | "hours" | "units";
type DayState = "planned" | "built" | "actual";
type LockVerdict = "MET" | "MISSED" | "NEAR" | "NA";
type LockMeta = { verdict: LockVerdict; note?: "Routes+Units" | "Units needed" };

function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
}

function dayNum(iso: string): string {
  return iso.slice(8, 10);
}

function n(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function fmt(mode: UnitMode, v: number | null): string {
  if (v === null) return "—";
  if (mode === "routes") return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

function fmtDelta(mode: UnitMode, v: number | null): string {
  if (v === null) return "—";
  const rounded = mode === "routes" ? Math.round(v) : Math.round(v * 10) / 10;
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function stateForDay(d: Day): DayState {
  if (d.has_check_in) return "actual";
  if (d.has_sv) return "built";
  return "planned";
}

function chipLabel(state: DayState): string {
  if (state === "actual") return "Actual";
  if (state === "built") return "Built";
  return "Planned";
}

function schLabelForState(state: DayState): string {
  if (state === "actual") return "Routes";
  if (state === "built") return "Routed";
  return "On Schedule";
}

function safePct(num: number, den: number): number | null {
  if (!den) return null;
  const p = num / den;
  if (!Number.isFinite(p)) return null;
  return Math.round(p * 1000) / 10;
}

function pillClassPlannedBuilt(deltaRoutes: number | null) {
  if (deltaRoutes === null) return "bg-[var(--to-surface-2)] border-[var(--to-border)]";
  if (deltaRoutes === 0) return "bg-[var(--to-surface-2)] border-[var(--to-border)]";
  if (deltaRoutes >= 1 && deltaRoutes <= 2) return "bg-[rgba(16,185,129,0.16)] border-[rgba(16,185,129,0.35)]";
  if (deltaRoutes > 2) return "bg-[rgba(234,179,8,0.18)] border-[rgba(234,179,8,0.40)]";
  return "bg-[rgba(239,68,68,0.20)] border-[rgba(239,68,68,0.45)]";
}

function pillClassActual(verdict: LockVerdict) {
  if (verdict === "MET") return "bg-[rgba(16,185,129,0.16)] border-[rgba(16,185,129,0.35)]";
  if (verdict === "NEAR") return "bg-[rgba(234,179,8,0.18)] border-[rgba(234,179,8,0.40)]";
  if (verdict === "MISSED") return "bg-[rgba(239,68,68,0.20)] border-[rgba(239,68,68,0.45)]";
  return "bg-[var(--to-surface-2)] border-[var(--to-border)]";
}

function verdictTextClass(verdict: LockVerdict) {
  if (verdict === "MET") return "text-[rgba(16,185,129,0.95)]";
  if (verdict === "NEAR") return "text-[rgba(234,179,8,0.95)]";
  if (verdict === "MISSED") return "text-[rgba(239,68,68,0.95)]";
  return "text-[var(--to-ink-muted)]";
}

function deltaTextClassPlannedBuilt(deltaRoutes: number | null) {
  if (deltaRoutes === null) return "text-[var(--to-ink-muted)]";
  if (deltaRoutes === 0) return "text-[var(--to-ink-muted)]";
  if (deltaRoutes >= 1 && deltaRoutes <= 2) return "text-[rgba(16,185,129,0.95)]";
  if (deltaRoutes > 2) return "text-[rgba(234,179,8,0.95)]";
  return "text-[rgba(239,68,68,0.95)]";
}

/**
 * Actual lock:
 * - Routes (actual_techs) vs quota_routes is first-class.
 * - If within 10% short on routes, units can carry (actual_units vs quota_units).
 */
function computeActualLock(d: Day): LockMeta {
  const quotaRoutes = n(d.quota_routes);
  if (quotaRoutes === null) return { verdict: "NA" };

  const actualRoutes = n(d.actual_techs);
  if (actualRoutes === null) return { verdict: "NA" };

  // pass on routes
  if (actualRoutes >= quotaRoutes) return { verdict: "MET" };

  // within 10% routes short?
  const within10Pct = actualRoutes >= quotaRoutes * 0.9;

  const quotaUnits = n(d.quota_units) ?? (n(d.quota_hours) === null ? null : (n(d.quota_hours) as number) * 12);
  const actualUnits = n(d.actual_units);

  if (within10Pct && quotaUnits !== null && actualUnits !== null) {
    if (actualUnits >= quotaUnits) return { verdict: "MET", note: "Routes+Units" };
    return { verdict: "NEAR", note: "Units needed" };
  }

  return { verdict: "MISSED" };
}

function valueForMode(args: { mode: UnitMode; state: DayState; d: Day }) {
  const { mode, state, d } = args;

  const quotaUnits = n(d.quota_units) ?? (n(d.quota_hours) === null ? null : (n(d.quota_hours) as number) * 12);

  if (mode === "routes") {
    const quota = n(d.quota_routes);
    const sch = state === "actual" ? n(d.actual_techs) : n(d.scheduled_routes);
    const delta = quota === null || sch === null ? null : sch - quota;
    return { sch, quota, delta };
  }

  if (mode === "hours") {
    const quota = n(d.quota_hours);
    const sch =
      state === "actual"
        ? n(d.actual_hours)
        : n(d.scheduled_routes) === null
          ? null
          : (n(d.scheduled_routes) as number) * 8;
    const delta = quota === null || sch === null ? null : sch - quota;
    return { sch, quota, delta };
  }

  const quota = quotaUnits;
  const sch =
    state === "actual"
      ? n(d.actual_units)
      : n(d.scheduled_routes) === null
        ? null
        : (n(d.scheduled_routes) as number) * 8 * 12;
  const delta = quota === null || sch === null ? null : sch - quota;
  return { sch, quota, delta };
}

export function RouteLockCalendarClient(props: { fiscal: Fiscal; days: Day[] }) {
  const [mode, setMode] = useState<UnitMode>("routes");

  const byWeek = useMemo(() => {
    const days = props.days;
    if (!days.length) return [];

    const start = new Date(`${days[0].date}T00:00:00Z`);
    const pad = start.getUTCDay(); // 0=Sun
    const padded: Array<Day | null> = Array.from({ length: pad }).map(() => null);

    const all = [...padded, ...days];

    const weeks: Array<Array<Day | null>> = [];
    for (let i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));
    return weeks;
  }, [props.days]);

  const fiscalLabel = props.fiscal.label ?? `Fiscal ${props.fiscal.start_date} → ${props.fiscal.end_date}`;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Calendar • {fiscalLabel}</div>
            <div className="text-xs text-[var(--to-ink-muted)]">
              Planned → Built → Actual. Verdict label renders only on Actual.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select className="to-input h-8 text-xs" value={mode} onChange={(e) => setMode(e.target.value as UnitMode)}>
              <option value="routes">Routes</option>
              <option value="hours">Hours</option>
              <option value="units">Units</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--to-border)] bg-[var(--to-surface-2)]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-3 py-2 text-xs font-medium text-[var(--to-ink-muted)]">
              {d}
            </div>
          ))}
        </div>

        <div className="grid gap-0">
          {byWeek.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((d, di) => {
                if (!d) return <div key={di} className="min-h-[118px] border-b border-r border-[var(--to-border)]" />;

                const state = stateForDay(d);

                // For tint on Planned/Built we use *routes* delta only (as designed).
                const routesSch = state === "actual" ? n(d.actual_techs) : n(d.scheduled_routes);
                const routesQuota = n(d.quota_routes);
                const deltaRoutes = routesSch === null || routesQuota === null ? null : routesSch - routesQuota;

                const lock = state === "actual" ? computeActualLock(d) : { verdict: "NA" as const };

                const pillClass = state === "actual" ? pillClassActual(lock.verdict) : pillClassPlannedBuilt(deltaRoutes);

                // Verdict label ONLY for Actual
                let verdictLabel: string | null = null;
                if (state === "actual") {
                  if (lock.verdict === "MET") verdictLabel = lock.note === "Routes+Units" ? "MET (Routes+Units)" : "MET";
                  if (lock.verdict === "NEAR") verdictLabel = "NEAR (Units needed)";
                  if (lock.verdict === "MISSED") verdictLabel = "MISSED";
                }

                const schQuotaDelta = valueForMode({ mode, state, d });

                const total = n(d.total_headcount) ?? 0;
                const worked = state === "actual" ? (n(d.actual_techs) ?? 0) : (n(d.scheduled_techs) ?? 0);
                const pct = safePct(worked, total);
                const hcRatio = total > 0 ? `${worked}/${total}` : `${worked}/—`;
                const hcPct = pct === null ? "—" : `${pct}%`;

                return (
                  <div
                    key={d.date}
                    className="min-h-[118px] border-b border-r border-[var(--to-border)] px-3 py-2 bg-transparent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className={[
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums border",
                              pillClass,
                            ].join(" ")}
                          >
                            <span>{dayNum(d.date)}</span>
                            <span className="text-[var(--to-ink-muted)] font-normal">{weekdayShort(d.date)}</span>
                          </div>

                          {verdictLabel ? (
                            <div className={["text-[10px] font-semibold tabular-nums", verdictTextClass(lock.verdict)].join(" ")}>
                              {verdictLabel}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="rounded px-1.5 py-0.5 border border-[var(--to-border)]">{chipLabel(state)}</span>
                      </div>
                    </div>

                    <div className="mt-2 space-y-1 text-xs tabular-nums">
                      <div className="flex justify-between">
                        <span className="text-[var(--to-ink-muted)]">Sch</span>
                        <span className="text-[var(--to-ink-muted)] mr-auto ml-2 text-[10px]">{schLabelForState(state)}</span>
                        <span>{fmt(mode, schQuotaDelta.sch)}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-[var(--to-ink-muted)]">Quota</span>
                        <span>{fmt(mode, schQuotaDelta.quota)}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-[var(--to-ink-muted)]">Δ</span>
                        <span
                          className={[
                            "font-medium",
                            state === "actual" ? verdictTextClass(lock.verdict) : deltaTextClassPlannedBuilt(deltaRoutes),
                          ].join(" ")}
                        >
                          {fmtDelta(mode, schQuotaDelta.delta)}
                        </span>
                      </div>

                      <div className="flex justify-between pt-1">
                        <span className="text-[var(--to-ink-muted)]">HC</span>
                        <span>
                          {hcRatio} <span className="text-[var(--to-ink-muted)]">({hcPct})</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}