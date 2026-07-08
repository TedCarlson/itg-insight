"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { DataTable, DataTableBody, DataTableHeader, DataTableRow } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";

type Technician = {
  assignment_id: string;
  tech_id: string;
  full_name: string;
  co_name: string | null;
  not_on_roster?: boolean;
};

type RouteRow = { route_id: string; route_name: string };

type QuotaRouteRow = {
  route_id: string;
  route_name: string;
  qh_sun: number | null;
  qh_mon: number | null;
  qh_tue: number | null;
  qh_wed: number | null;
  qh_thu: number | null;
  qh_fri: number | null;
  qh_sat: number | null;
};

type ScheduleBaselineRow = {
  schedule_baseline_month_id?: string;
  assignment_id: string;
  tech_id: string;
  default_route_id: string | null;
  sun: boolean | null;
  mon: boolean | null;
  tue: boolean | null;
  wed: boolean | null;
  thu: boolean | null;
  fri: boolean | null;
  sat: boolean | null;
  sch_hours_sun?: number | null;
  sch_hours_mon?: number | null;
  sch_hours_tue?: number | null;
  sch_hours_wed?: number | null;
  sch_hours_thu?: number | null;
  sch_hours_fri?: number | null;
  sch_hours_sat?: number | null;
};

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
const SHIFT_HOURS = [8, 10] as const;

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "sun", label: "Sun" },
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
];

type RowState = {
  assignmentId: string;
  techId: string;
  name: string;
  coName: string | null;
  notOnRoster: boolean;
  routeId: string; // "" means unset
  days: Record<DayKey, boolean>;
  shiftHours: 8 | 10;

  // staged "purge" flag (delete trigger = dirty)
  deleteArmed: boolean;
};

export type ScheduleTotals = {
  techs: number;
  perDay: Record<DayKey, number>;
  totalDaysOn: number;
  totalHours: number;
  totalUnits: number;
};

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const techIdCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function compareTechId(a: string, b: string) {
  return techIdCollator.compare(String(a ?? "").trim(), String(b ?? "").trim());
}

function shiftHoursFromBaselineRow(row: ScheduleBaselineRow | undefined): 8 | 10 {
  if (!row) return 8;

  const values = DAYS
    .map((d) => Number(row[`sch_hours_${d.key}` as keyof ScheduleBaselineRow] ?? 0))
    .filter((value) => value > 0);

  if (values.some((value) => value >= 10)) return 10;
  return 8;
}

function DayToggle({
  dayLabel,
  value,
  onToggle,
}: {
  dayLabel: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cls(
        "to-pill select-none w-full",
        "h-7 px-2 text-xs leading-none",
        value
          ? "border-[var(--to-success)] text-[var(--to-success)] bg-[var(--to-toggle-active-bg)]"
          : "border-[var(--to-warning)] text-[var(--to-warning)] bg-[var(--to-surface-soft)]"
      )}
      aria-pressed={value}
    >
      {value ? dayLabel : "Off"}
    </button>
  );
}

/**
 * IMPORTANT:
 * - If NO persisted baseline row exists for this tech in this fiscal month,
 *   we default to OFF (all days false) so "next month empty until seed" is respected
 *   and so missing hydration doesn't silently appear as "all scheduled".
 */
function normalizeFromBaselineRow(s?: ScheduleBaselineRow) {
  const hasRow = !!s;

  return {
    routeId: String(s?.default_route_id ?? ""),
    days: {
      sun: hasRow ? !!s?.sun : false,
      mon: hasRow ? !!s?.mon : false,
      tue: hasRow ? !!s?.tue : false,
      wed: hasRow ? !!s?.wed : false,
      thu: hasRow ? !!s?.thu : false,
      fri: hasRow ? !!s?.fri : false,
      sat: hasRow ? !!s?.sat : false,
    } as Record<DayKey, boolean>,
  };
}

function buildRows(
  technicians: Technician[],
  scheduleByAssignment: Record<string, ScheduleBaselineRow>
): RowState[] {
  const sorted = [...technicians].sort((a, b) => {
    const techOrder = compareTechId(a.tech_id, b.tech_id);
    if (techOrder !== 0) return techOrder;
    return String(a.full_name ?? "").localeCompare(String(b.full_name ?? ""));
  });

  return sorted.map((t) => {
    const s = scheduleByAssignment[t.assignment_id];
    const norm = normalizeFromBaselineRow(s);
    return {
      assignmentId: t.assignment_id,
      techId: t.tech_id,
      name: t.full_name,
      coName: t.co_name ?? null,
      notOnRoster: !!t.not_on_roster,
      routeId: norm.routeId,
      days: norm.days,
      shiftHours: shiftHoursFromBaselineRow(s),
      deleteArmed: false,
    };
  });
}

function rowsEqual(a: RowState, b: { routeId: string; days: Record<DayKey, boolean> }) {
  if (a.routeId !== b.routeId) return false;
  for (const d of DAYS) {
    if (a.days[d.key] !== b.days[d.key]) return false;
  }
  return true;
}

function fmtInt(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.trunc(n)) : "0";
}

function allDaysOff(days: Record<DayKey, boolean>): boolean {
  for (const d of DAYS) {
    if (days[d.key]) return false;
  }
  return true;
}

function setAllDays(next: boolean): Record<DayKey, boolean> {
  return { sun: next, mon: next, tue: next, wed: next, thu: next, fri: next, sat: next };
}

function fmtCooldown(seconds: number) {
  const s = Math.max(0, Math.trunc(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function fmtPct(part: number, whole: number) {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function readinessPct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function readinessClass(pct: number): string {
  if (pct < 90) return "text-[var(--to-danger)]";
  if (pct < 100) return "text-[var(--to-warning)]";
  if (pct <= 110) return "text-[var(--to-success)]";
  return "text-[var(--to-warning)]";
}

function quotaHoursForDay(row: QuotaRouteRow, day: DayKey): number {
  const key = `qh_${day}` as keyof QuotaRouteRow;
  const n = Number(row[key]);
  return Number.isFinite(n) ? n : 0;
}

function sumQuotaByDay(rows: QuotaRouteRow[]): Record<DayKey, number> {
  const perDay: Record<DayKey, number> = { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 };

  for (const r of rows) {
    for (const d of DAYS) {
      perDay[d.key] += quotaHoursForDay(r, d.key) / 8;
    }
  }

  return perDay;
}

export function ScheduleGridClient({
  technicians,
  routes,
  quotaRows,
  scheduleByAssignment,
  previousScheduleByAssignment = {},
  fiscalMonthId,
  defaults,
  onTotalsChange,
}: {
  technicians: Technician[];
  routes: RouteRow[];
  quotaRows: QuotaRouteRow[];
  scheduleByAssignment: Record<string, ScheduleBaselineRow>;
  previousScheduleByAssignment?: Record<string, ScheduleBaselineRow>;
  fiscalMonthId: string;
  defaults: { unitsPerHour: number; hoursPerDay: number };
  onTotalsChange?: (t: ScheduleTotals) => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState<string>("");
  const [rows, setRows] = useState<RowState[]>(() => buildRows(technicians, scheduleByAssignment));

  const baselineRef = useRef<Record<string, { routeId: string; days: Record<DayKey, boolean>; shiftHours: 8 | 10 }> | null>(null);

  if (baselineRef.current === null) {
    const snap: Record<string, { routeId: string; days: Record<DayKey, boolean>; shiftHours: 8 | 10 }> = {};
    for (const t of technicians) {
      const s = scheduleByAssignment[t.assignment_id];
      snap[t.assignment_id] = { ...normalizeFromBaselineRow(s), shiftHours: shiftHoursFromBaselineRow(s) };
    }
    baselineRef.current = snap;
  }

  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");

  // Stage All
  const [stageAll, setStageAll] = useState(false);
  const [stageAllCooldownUntil, setStageAllCooldownUntil] = useState<number | null>(null);
  const [, setCooldownTick] = useState(0); // repaint countdown text only

  const stageAllMsLeft = stageAllCooldownUntil ? Math.max(0, stageAllCooldownUntil - Date.now()) : 0;
  const isStageAllCooling = stageAllMsLeft > 0;

  useEffect(() => {
    if (!isStageAllCooling) return;
    const t = setInterval(() => setCooldownTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [isStageAllCooling]);

  // Hydrate on prop changes
  useEffect(() => {
    const nextRows = buildRows(technicians, scheduleByAssignment);
    setRows(nextRows);

    const snap: Record<string, { routeId: string; days: Record<DayKey, boolean>; shiftHours: 8 | 10 }> = {};
    for (const t of technicians) {
      const s = scheduleByAssignment[t.assignment_id];
      snap[t.assignment_id] = { ...normalizeFromBaselineRow(s), shiftHours: shiftHoursFromBaselineRow(s) };
    }
    baselineRef.current = snap;

    setSaveMsg("");
    setStageAll(false);
  }, [technicians, scheduleByAssignment]);

  const routeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const route of routes) {
      map.set(String(route.route_id ?? ""), String(route.route_name ?? ""));
    }
    return map;
  }, [routes]);

  const totals = useMemo<ScheduleTotals>(() => {
    const perDay: Record<DayKey, number> = { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 };
    let totalDaysOn = 0;

    for (const r of rows) {
      for (const d of DAYS) {
        if (r.days[d.key]) {
          perDay[d.key] += 1;
          totalDaysOn += 1;
        }
      }
    }

    const totalHours = rows.reduce(
      (sum, row) => sum + DAYS.reduce((daySum, d) => daySum + (row.days[d.key] ? row.shiftHours : 0), 0),
      0,
    );
    const totalUnits = totalHours * defaults.unitsPerHour;

    return {
      techs: rows.length,
      perDay,
      totalDaysOn,
      totalHours,
      totalUnits,
    };
  }, [rows, defaults.unitsPerHour]);

  useEffect(() => {
    onTotalsChange?.(totals);
  }, [totals, onTotalsChange]);

  const dirtyRows = useMemo(() => {
    const base = baselineRef.current ?? {};
    return rows.filter((r) => {
      if (r.deleteArmed) return true;

      const b = base[r.assignmentId];
      if (!b) return true;
      return !rowsEqual(r, b) || r.shiftHours !== b.shiftHours;
    });
  }, [rows]);

  const commitRows = useMemo(() => {
    const source = stageAll ? rows : dirtyRows;
    return source;
  }, [stageAll, rows, dirtyRows]);

  const canCommit = !isSaving && (stageAll || dirtyRows.length > 0);

  function setRoute(assignmentId: string, nextRouteId: string) {
    setRows((prev) => prev.map((r) => (r.assignmentId === assignmentId ? { ...r, routeId: nextRouteId } : r)));
  }

  function setShiftHours(assignmentId: string, shiftHours: 8 | 10) {
    setRows((prev) => prev.map((r) => (r.assignmentId === assignmentId ? { ...r, shiftHours } : r)));
  }

  function toggleDay(assignmentId: string, day: DayKey) {
    setRows((prev) =>
      prev.map((r) => (r.assignmentId === assignmentId ? { ...r, days: { ...r.days, [day]: !r.days[day] } } : r))
    );
  }

  function toggleAllDays(assignmentId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.assignmentId !== assignmentId) return r;
        const isAllOff = allDaysOff(r.days);
        return {
          ...r,
          days: setAllDays(isAllOff ? true : false),
        };
      })
    );
  }

  function toggleDeleteArmed(assignmentId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.assignmentId !== assignmentId) return r;
        if (!r.notOnRoster) return r;
        return { ...r, deleteArmed: !r.deleteArmed };
      })
    );
  }

  function paintFromPrevious() {
    if (previousPaintCount <= 0) {
      toast.push({
        variant: "warning",
        title: "Nothing to paint",
        message: "No previous-month schedule baseline was found for the visible assignment set.",
        durationMs: 2600,
      });
      return;
    }

    setRows((prev) =>
      prev.map((r) => {
        const source = previousScheduleByAssignment[r.assignmentId];
        if (!source) return r;

        const norm = normalizeFromBaselineRow(source);
        return {
          ...r,
          routeId: norm.routeId,
          days: { ...norm.days },
          shiftHours: shiftHoursFromBaselineRow(source),
          deleteArmed: false,
        };
      })
    );

    toast.push({
      variant: "success",
      title: "Previous schedule painted",
      message: `Staged ${previousPaintCount} rows from the previous fiscal month. Review, then Commit changes.`,
      durationMs: 3000,
    });
  }

  const viewRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? rows
      : rows.filter((r) => {
          const tech = String(r.techId ?? "").toLowerCase();
          const name = String(r.name ?? "").toLowerCase();
          const co = String(r.coName ?? "").toLowerCase();
          const routeId = String(r.routeId ?? "").toLowerCase();
          const routeName = String(routeNameById.get(String(r.routeId ?? "")) ?? "").toLowerCase();

          return (
            tech.includes(q) ||
            name.includes(q) ||
            co.includes(q) ||
            routeId.includes(q) ||
            routeName.includes(q)
          );
        });

    return [...filtered].sort((a, b) => {
      const techOrder = compareTechId(a.techId, b.techId);
      if (techOrder !== 0) return techOrder;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
  }, [rows, search, routeNameById]);

    const filteredTotals = useMemo<ScheduleTotals>(() => {
    const perDay: Record<DayKey, number> = { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 };
    let totalDaysOn = 0;

    for (const r of viewRows) {
      for (const d of DAYS) {
        if (r.days[d.key]) {
          perDay[d.key] += 1;
          totalDaysOn += 1;
        }
      }
    }

    const totalHours = rows.reduce(
      (sum, row) => sum + DAYS.reduce((daySum, d) => daySum + (row.days[d.key] ? row.shiftHours : 0), 0),
      0,
    );
    const totalUnits = totalHours * defaults.unitsPerHour;

    return {
      techs: viewRows.length,
      perDay,
      totalDaysOn,
      totalHours,
      totalUnits,
    };
  }, [viewRows, rows, defaults.unitsPerHour]);

  const unscheduledRowsCount = useMemo(() => {
    return rows.filter((r) => allDaysOff(r.days)).length;
  }, [rows]);

  const previousPaintCount = useMemo(() => {
    return rows.filter((r) => !!previousScheduleByAssignment[r.assignmentId]).length;
  }, [rows, previousScheduleByAssignment]);

  const filterActive = search.trim().length > 0;

  const quotaTotals = useMemo(() => sumQuotaByDay(quotaRows), [quotaRows]);

  const filteredQuotaTotals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotaTotals;

    const visibleRouteIds = new Set(viewRows.map((r) => String(r.routeId ?? "")).filter(Boolean));

    const scopedRows = quotaRows.filter((r) => {
      const routeId = String(r.route_id ?? "").toLowerCase();
      const routeName = String(r.route_name ?? "").toLowerCase();

      return routeId.includes(q) || routeName.includes(q) || visibleRouteIds.has(String(r.route_id ?? ""));
    });

    return sumQuotaByDay(scopedRows);
  }, [quotaRows, quotaTotals, search, viewRows]);

  const activeShiftMix = useMemo(() => {
    const source = filterActive ? viewRows : rows;
    const byDay: Record<DayKey, { eight: number; ten: number; hours: number; units: number }> = {
      sun: { eight: 0, ten: 0, hours: 0, units: 0 },
      mon: { eight: 0, ten: 0, hours: 0, units: 0 },
      tue: { eight: 0, ten: 0, hours: 0, units: 0 },
      wed: { eight: 0, ten: 0, hours: 0, units: 0 },
      thu: { eight: 0, ten: 0, hours: 0, units: 0 },
      fri: { eight: 0, ten: 0, hours: 0, units: 0 },
      sat: { eight: 0, ten: 0, hours: 0, units: 0 },
    };

    let weeklyEight = 0;
    let weeklyTen = 0;
    let weeklyHours = 0;
    let weeklyUnits = 0;

    for (const row of source) {
      for (const d of DAYS) {
        if (!row.days[d.key]) continue;

        const hours = row.shiftHours;
        const units = hours * defaults.unitsPerHour;

        if (hours === 10) {
          byDay[d.key].ten += 1;
          weeklyTen += 1;
        } else {
          byDay[d.key].eight += 1;
          weeklyEight += 1;
        }

        byDay[d.key].hours += hours;
        byDay[d.key].units += units;
        weeklyHours += hours;
        weeklyUnits += units;
      }
    }

    return { byDay, weeklyEight, weeklyTen, weeklyHours, weeklyUnits };
  }, [filterActive, viewRows, rows, defaults.unitsPerHour]);

  const activeQuotaTotals = filterActive ? filteredQuotaTotals : quotaTotals;
  const activeScheduledTotals = filterActive ? filteredTotals.perDay : totals.perDay;

  const commitLabel = stageAll ? "Commit changes (ALL)" : `Commit changes (${dirtyRows.length})`;

  async function purgeOneTech(techId: string) {
    const res = await fetch("/api/route-lock/schedule/delete-tech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_month_id: fiscalMonthId, tech_id: techId }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      const err = String(json?.error ?? `Purge failed (${res.status})`);
      throw new Error(err);
    }
    return json;
  }

  async function commitChanges() {
    setSaveMsg("");

    if (commitRows.length === 0) {
      setSaveMsg("No changes to commit.");
      return;
    }

    setIsSaving(true);
    try {
      const purgeRows = commitRows.filter((r) => r.deleteArmed);
      for (const r of purgeRows) {
        await purgeOneTech(r.techId);

        setRows((prev) => prev.filter((x) => x.assignmentId !== r.assignmentId));

        toast.push({
          variant: "success",
          title: "Tech purged",
          message: `Removed today+forward evidence for Tech ${r.techId} (baseline + exceptions + sweep).`,
          durationMs: 2200,
        });
      }

      const upsertRows = commitRows.filter((r) => !r.deleteArmed);

      if (upsertRows.length > 0) {
        const payload = {
          fiscal_month_id: fiscalMonthId,
          hoursPerDay: defaults.hoursPerDay,
          unitsPerHour: defaults.unitsPerHour,
          rows: upsertRows.map((r) => ({
            assignment_id: r.assignmentId,
            tech_id: r.techId,
            default_route_id: r.routeId ? r.routeId : null,
            days: r.days,
            shiftHours: r.shiftHours,
          })),
        };

        const res = await fetch("/api/route-lock/schedule/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.ok) {
          const err = String(json?.error ?? `Commit failed (${res.status})`);
          setSaveMsg(err);
          toast.push({ variant: "danger", title: "Commit failed", message: err, durationMs: 2600 });
          return;
        }

        const inserted = fmtInt(json?.inserted ?? json?.rows_inserted ?? json?.baseline_inserted ?? json?.baseline_upserted);
        const updated = fmtInt(json?.updated ?? json?.rows_updated ?? json?.baseline_updated);

        const sweepUp = fmtInt(
          json?.sweep?.rows_upserted ??
            json?.sweep_rows_upserted ??
            json?.rows_upserted ??
            json?.sweep_upserted ??
            json?.sweep?.rows_upserted
        );
        const sweepDel = fmtInt(
          json?.sweep?.rows_deleted ??
            json?.sweep_rows_deleted ??
            json?.rows_deleted ??
            json?.sweep_deleted ??
            json?.sweep?.rows_deleted
        );

        const nextBase: Record<string, { routeId: string; days: Record<DayKey, boolean>; shiftHours: 8 | 10 }> = {};
        for (const r of upsertRows) {
          nextBase[r.assignmentId] = {
            routeId: r.routeId,
            days: { ...r.days },
            shiftHours: r.shiftHours,
          };
        }
        baselineRef.current = nextBase;

        if (stageAll) {
          setStageAll(false);
          setStageAllCooldownUntil(Date.now() + 60_000);
        }

        toast.push({
          variant: "success",
          title: "Schedule saved",
          message: `Baseline: +${inserted} inserted, ${updated} updated • Sweep: ${sweepUp} upserted, ${sweepDel} deleted`,
          durationMs: 2600,
        });
      }

      router.refresh();
    } catch (e: any) {
      const msg = String(e?.message ?? "Commit failed");
      setSaveMsg(msg);
      toast.push({ variant: "danger", title: "Commit failed", message: msg, durationMs: 2600 });
    } finally {
      setIsSaving(false);
    }
  }

  const gridStyle: CSSProperties = useMemo(
    () => ({
      gridTemplateColumns: "6rem minmax(13rem,18rem) 5.75rem 11rem repeat(7, 5.25rem) minmax(19rem,1fr) 5.25rem",
    }),
    []
  );

  return (
    <Card>
      <div className="flex flex-col gap-2 p-3 border-b border-[var(--to-border)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-[var(--to-ink-muted)]">Search</div>
            <input
              className="to-input h-8 text-xs w-[min(320px,60vw)]"
              placeholder="tech id, name, company, route…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="to-btn to-btn--secondary h-8 px-3 text-xs"
              disabled={isSaving || previousPaintCount <= 0}
              onClick={paintFromPrevious}
              aria-disabled={isSaving || previousPaintCount <= 0}
              title="Paint this schedule surface from the previous fiscal month. This stages changes only; Commit changes saves them."
            >
              Paint from Previous
            </button>

            <button
              type="button"
              className={cls("to-btn h-8 px-3 text-xs", stageAll ? "to-btn--primary" : "to-btn--secondary")}
              disabled={isSaving || isStageAllCooling}
              onClick={() => setStageAll((v) => !v)}
              aria-disabled={isSaving || isStageAllCooling}
              title={
                isStageAllCooling
                  ? "Stage All is temporarily locked after a full rewrite."
                  : "Stage all rows so Commit writes a full baseline."
              }
            >
              {isStageAllCooling ? (
                <>Stage All (locked {fmtCooldown(stageAllMsLeft / 1000)})</>
              ) : stageAll ? (
                "Stage All: ON"
              ) : (
                "Stage All"
              )}
            </button>

            <button
              type="button"
              className="to-btn to-btn--secondary h-8 px-3 text-xs"
              disabled={isSaving || !canCommit}
              onClick={commitChanges}
              aria-disabled={isSaving || !canCommit}
            >
              {isSaving ? "Committing…" : commitLabel}
            </button>
          </div>
        </div>

        {saveMsg ? <div className="text-sm text-[var(--to-ink-muted)]">{saveMsg}</div> : null}
      </div>

      <div className="border-b border-[var(--to-border)] px-3 py-2 bg-[var(--to-surface)]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--to-ink-muted)]">
            <div>
              Visible rows:{" "}
              <span className="font-medium text-[var(--to-ink)]">{viewRows.length}</span>
              {filterActive ? (
                <>
                  {" "}
                  of <span className="font-medium text-[var(--to-ink)]">{rows.length}</span>
                </>
              ) : null}
            </div>

            <div>
              Unscheduled rows:{" "}
              <span className="font-medium text-[var(--to-ink)]">{unscheduledRowsCount}</span>
            </div>
          </div>
        </div>
      <div className={cls("relative", "max-h-[calc(100vh-16rem)]", "overflow-auto")}>
        <div className="sticky top-0 z-20 bg-[var(--to-surface)] border-b border-[var(--to-border)]">
          <DataTable layout="fixed" gridStyle={gridStyle}>
            <div className="px-0 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
              Planning Summary
            </div>

            <div className="grid items-center bg-[var(--to-surface-soft)] text-xs font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]" style={gridStyle}>
              <div className="col-start-4 py-1">Coverage</div>
              <div className="col-span-7" />
              <div />
              <div />
            </div>

            <div
              className="grid items-center border-b border-[var(--to-border)] text-sm"
              style={gridStyle}
            >
              <div className="col-start-4 font-medium text-[var(--to-ink)]">{filterActive ? "Filtered Quota" : "Quota"}</div>
              {DAYS.map((d) => (
                <div key={`quota-${d.key}`} className="text-center font-medium">
                  {Math.trunc(activeQuotaTotals[d.key])}
                </div>
              ))}
              <div />
              <div />
            </div>

            <div
              className="grid items-center border-b border-[var(--to-border)] text-sm"
              style={gridStyle}
            >
              <div className="col-start-4 font-medium text-[var(--to-ink)]">{filterActive ? "Filtered Scheduled" : "Scheduled"}</div>
              {DAYS.map((d) => (
                <div key={`scheduled-${d.key}`} className="text-center font-medium">
                  {activeScheduledTotals[d.key]}
                </div>
              ))}
              <div />
              <div />
            </div>

            <div
              className="grid items-center border-b border-[var(--to-border)] text-sm"
              style={gridStyle}
            >
              <div className="col-start-4 font-medium text-[var(--to-ink)]">Gap</div>
              {DAYS.map((d) => {
                const gap = activeScheduledTotals[d.key] - activeQuotaTotals[d.key];
                return (
                  <div
                    key={`gap-${d.key}`}
                    className={cls(
                      "text-center font-medium",
                      gap < 0 ? "text-[var(--to-danger)]" : gap > 0 ? "text-[var(--to-success)]" : "text-[var(--to-ink)]"
                    )}
                  >
                    {gap > 0 ? `+${Math.trunc(gap)}` : Math.trunc(gap)}
                  </div>
                );
              })}
              <div />
              <div />
            </div>

            <div
              className="grid items-center border-b border-[var(--to-border)] text-sm"
              style={gridStyle}
            >
              <div className="col-start-4 font-medium text-[var(--to-ink)]">Readiness</div>
              {DAYS.map((d) => (
                <div
                  key={`readiness-${d.key}`}
                  className={cls("text-center font-medium", readinessClass(readinessPct(activeScheduledTotals[d.key], activeQuotaTotals[d.key])))}
                >
                  {fmtPct(activeScheduledTotals[d.key], activeQuotaTotals[d.key])}
                </div>
              ))}
              <div />
              <div />
            </div>

            <div className="grid items-center bg-[var(--to-surface-soft)] text-xs font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]" style={gridStyle}>
              <div className="col-start-4 py-1">Capacity</div>
              <div className="col-span-7" />
              <div />
              <div />
            </div>

            <div
              className="grid items-center border-b border-[var(--to-border)] text-sm"
              style={gridStyle}
            >
              <div className="col-start-4 font-medium text-[var(--to-ink)]">8h Tech-Days</div>
              {DAYS.map((d) => (
                <div key={`eight-${d.key}`} className="text-center font-medium">
                  {activeShiftMix.byDay[d.key].eight}
                </div>
              ))}
              <div className="font-medium tabular-nums">{activeShiftMix.weeklyEight} tech-days</div>
              <div />
            </div>

            <div
              className="grid items-center border-b border-[var(--to-border)] text-sm"
              style={gridStyle}
            >
              <div className="col-start-4 font-medium text-[var(--to-ink)]">10h Tech-Days</div>
              {DAYS.map((d) => (
                <div key={`ten-${d.key}`} className="text-center font-medium">
                  {activeShiftMix.byDay[d.key].ten}
                </div>
              ))}
              <div className="font-medium tabular-nums">{activeShiftMix.weeklyTen} tech-days</div>
              <div />
            </div>

            <div
              className="grid items-center border-b border-[var(--to-border)] text-sm"
              style={gridStyle}
            >
              <div className="col-start-4 font-medium text-[var(--to-ink)]">Hours</div>
              {DAYS.map((d) => (
                <div key={`hours-${d.key}`} className="text-center font-medium">
                  {activeShiftMix.byDay[d.key].hours}
                </div>
              ))}
              <div className="font-medium tabular-nums">{activeShiftMix.weeklyHours} hours</div>
              <div />
            </div>

            <div
              className="grid items-center border-b border-[var(--to-border)] text-sm"
              style={gridStyle}
            >
              <div className="col-start-4 font-medium text-[var(--to-ink)]">Units</div>
              {DAYS.map((d) => (
                <div key={`units-${d.key}`} className="text-center font-medium">
                  {Math.round(activeShiftMix.byDay[d.key].units)}
                </div>
              ))}
              <div className="font-medium tabular-nums">{Math.round(activeShiftMix.weeklyUnits)} units</div>
              <div />
            </div>

            <div className="h-3 border-b border-[var(--to-border)]" />

            <DataTableHeader gridStyle={gridStyle}>
              <div className="whitespace-nowrap">Tech Id</div>
              <div className="min-w-0">Name</div>
              <div className="whitespace-nowrap text-center"> </div>
              <div className="whitespace-nowrap">Route</div>
              {DAYS.map((d) => (
                <div key={d.key} className="text-center whitespace-nowrap">
                  {d.label}
                </div>
              ))}
              <div className="whitespace-nowrap">Stats</div>
              <div className="text-center whitespace-nowrap">Delete</div>
            </DataTableHeader>
          </DataTable>
        </div>

        <DataTable layout="fixed" gridStyle={gridStyle}>
          <DataTableBody zebra>
            {viewRows.map((r) => {
              const isAllOff = allDaysOff(r.days);
              const btnLabel = isAllOff ? "Add" : "Remove";

              const daysOn = Object.values(r.days).reduce((acc, v) => acc + (v ? 1 : 0), 0);
              const hours = daysOn * r.shiftHours;
              const units = hours * defaults.unitsPerHour;

              const deleteEnabled = r.notOnRoster;

              return (
                <DataTableRow key={r.assignmentId} gridStyle={gridStyle} className="items-center">
                  <div className="whitespace-nowrap font-identifier">{r.techId}</div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="truncate">{r.name}</div>
                      {r.notOnRoster ? (
                        <span
                          className={cls(
                            "to-pill",
                            "h-6 px-2 text-[10px] leading-none inline-flex items-center",
                            "border-[var(--to-danger)] text-[var(--to-danger)] bg-[var(--to-surface-soft)]"
                          )}
                          title="This baseline exists, but the tech is not an active roster member for this org."
                        >
                          NOT ON ROSTER
                        </span>
                      ) : null}
                    </div>
                    {r.coName ? <div className="truncate text-xs text-[var(--to-ink-muted)]">{r.coName}</div> : null}
                  </div>

                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      className="to-btn to-btn--secondary h-7 px-2 text-xs"
                      onClick={() => toggleAllDays(r.assignmentId)}
                      title={isAllOff ? "Add all 7 days" : "Remove all 7 days"}
                      disabled={r.deleteArmed}
                    >
                      {btnLabel}
                    </button>
                  </div>

                  <div className="flex items-center">
                    <select
                      className="to-select h-8 text-xs"
                      value={r.routeId}
                      onChange={(e) => setRoute(r.assignmentId, e.target.value)}
                      disabled={r.deleteArmed}
                    >
                      <option value="">—</option>
                      {routes.map((rt) => (
                        <option key={rt.route_id} value={rt.route_id}>
                          {rt.route_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {DAYS.map((d) => (
                    <div key={d.key} className="flex items-center">
                      <DayToggle
                        dayLabel={d.label}
                        value={!!r.days[d.key]}
                        onToggle={() => toggleDay(r.assignmentId, d.key)}
                      />
                    </div>
                  ))}

                  <div className="flex items-center gap-2 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-1">
                      {SHIFT_HOURS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={cls(
                            "to-pill h-7 px-2 text-xs leading-none",
                            r.shiftHours === value
                              ? "border-blue-500 text-blue-700 bg-blue-50"
                              : "border-[var(--to-border)] text-[var(--to-ink-muted)] bg-[var(--to-surface-soft)]"
                          )}
                          onClick={() => setShiftHours(r.assignmentId, value)}
                          disabled={r.deleteArmed}
                          aria-pressed={r.shiftHours === value}
                          title={`${value} hour shift`}
                        >
                          {value}h
                        </button>
                      ))}
                    </div>
                    <span>{daysOn} days • {Math.round(units)} units • {hours.toFixed(0)} hours</span>
                  </div>

                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--to-danger)]"
                      checked={r.deleteArmed}
                      disabled={isSaving || !deleteEnabled}
                      onChange={() => toggleDeleteArmed(r.assignmentId)}
                      title={
                        deleteEnabled
                          ? "Arms a purge: remove today+forward evidence for this tech on Commit."
                          : "Only available for NOT ON ROSTER rows."
                      }
                    />
                  </div>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      </div>
      </div>
    </Card>
  );
}