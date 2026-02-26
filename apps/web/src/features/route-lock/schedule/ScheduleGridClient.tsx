// RUN THIS
// Replace the entire file with the contents below.

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
};

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
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

function techSortKey(techId: string) {
  const n = Number(techId);
  return Number.isFinite(n) ? n : techId;
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
    const ak = techSortKey(String(a.tech_id ?? ""));
    const bk = techSortKey(String(b.tech_id ?? ""));
    // @ts-ignore
    if (ak < bk) return -1;
    // @ts-ignore
    if (ak > bk) return 1;
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

export function ScheduleGridClient({
  technicians,
  routes,
  scheduleByAssignment,
  fiscalMonthId,
  defaults,
  onTotalsChange,
}: {
  technicians: Technician[];
  routes: RouteRow[];
  scheduleByAssignment: Record<string, ScheduleBaselineRow>;
  fiscalMonthId: string;
  defaults: { unitsPerHour: number; hoursPerDay: number };
  onTotalsChange?: (t: ScheduleTotals) => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState<string>("");
  const [rows, setRows] = useState<RowState[]>(() => buildRows(technicians, scheduleByAssignment));

  const baselineRef = useRef<Record<string, { routeId: string; days: Record<DayKey, boolean> }> | null>(null);

  if (baselineRef.current === null) {
    const snap: Record<string, { routeId: string; days: Record<DayKey, boolean> }> = {};
    for (const t of technicians) {
      const s = scheduleByAssignment[t.assignment_id];
      snap[t.assignment_id] = normalizeFromBaselineRow(s);
    }
    baselineRef.current = snap;
  }

  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");

  // Stage All
  const [stageAll, setStageAll] = useState(false);
  const [stageAllCooldownUntil, setStageAllCooldownUntil] = useState<number | null>(null);
  const [cooldownTick, setCooldownTick] = useState(0); // used only to repaint countdown text

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

    const snap: Record<string, { routeId: string; days: Record<DayKey, boolean> }> = {};
    for (const t of technicians) {
      const s = scheduleByAssignment[t.assignment_id];
      snap[t.assignment_id] = normalizeFromBaselineRow(s);
    }
    baselineRef.current = snap;

    setSaveMsg("");

    // month change / data rehydrate should not carry a staged-all intent across loads
    setStageAll(false);
  }, [technicians, scheduleByAssignment]);

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

    const totalHours = totalDaysOn * defaults.hoursPerDay;
    const totalUnits = totalHours * defaults.unitsPerHour;

    return {
      techs: rows.length,
      perDay,
      totalDaysOn,
      totalHours,
      totalUnits,
    };
  }, [rows, defaults.hoursPerDay, defaults.unitsPerHour]);

  useEffect(() => {
    onTotalsChange?.(totals);
  }, [totals, onTotalsChange]);

  const dirtyRows = useMemo(() => {
    const base = baselineRef.current ?? {};
    return rows.filter((r) => {
      const b = base[r.assignmentId];
      if (!b) return true;
      return !rowsEqual(r, b);
    });
  }, [rows]);

  const commitRows = stageAll ? rows : dirtyRows;
  const canCommit = !isSaving && (stageAll || dirtyRows.length > 0);

  async function commitChanges() {
    setSaveMsg("");

    if (commitRows.length === 0) {
      setSaveMsg("No changes to commit.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        fiscal_month_id: fiscalMonthId,
        hoursPerDay: defaults.hoursPerDay,
        unitsPerHour: defaults.unitsPerHour,
        rows: commitRows.map((r) => ({
          assignment_id: r.assignmentId,
          tech_id: r.techId,
          default_route_id: r.routeId ? r.routeId : null,
          days: r.days,
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

      const nextBase: Record<string, { routeId: string; days: Record<DayKey, boolean> }> = {};
      for (const r of rows) {
        nextBase[r.assignmentId] = { routeId: r.routeId, days: { ...r.days } };
      }
      baselineRef.current = nextBase;

      // Stage All cooldown ONLY when it was used for this commit
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

      router.refresh();
    } catch (e: any) {
      const msg = String(e?.message ?? "Commit failed");
      setSaveMsg(msg);
      toast.push({ variant: "danger", title: "Commit failed", message: msg, durationMs: 2600 });
    } finally {
      setIsSaving(false);
    }
  }

  // Columns:
  // TechId | Name | Add/Remove | Route | 7 Days | Stats
  const gridStyle: CSSProperties = useMemo(
    () => ({
      gridTemplateColumns: "6rem minmax(14rem,1fr) 5.75rem 11rem repeat(7, 5.25rem) minmax(16rem, 0.9fr)",
    }),
    []
  );

  function setRoute(assignmentId: string, nextRouteId: string) {
    setRows((prev) => prev.map((r) => (r.assignmentId === assignmentId ? { ...r, routeId: nextRouteId } : r)));
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

  const viewRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? rows
      : rows.filter((r) => {
          const tech = String(r.techId ?? "").toLowerCase();
          const name = String(r.name ?? "").toLowerCase();
          const co = String(r.coName ?? "").toLowerCase();
          return tech.includes(q) || name.includes(q) || co.includes(q);
        });

    return [...filtered].sort((a, b) => {
      const ak = techSortKey(String(a.techId ?? ""));
      const bk = techSortKey(String(b.techId ?? ""));
      // @ts-ignore
      if (ak < bk) return -1;
      // @ts-ignore
      if (ak > bk) return 1;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
  }, [rows, search]);

  return (
    <Card>
      {/* Top controls */}
      <div className="flex flex-col gap-2 p-3 border-b border-[var(--to-border)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-[var(--to-ink-muted)]">Schedule Changes</div>
            <div className="text-sm font-medium">
              {stageAll ? (
                <span className="inline-flex items-center gap-2">
                  <span>ALL</span>
                  <span className="text-xs text-[var(--to-ink-muted)]">({rows.length})</span>
                </span>
              ) : (
                dirtyRows.length
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-xs text-[var(--to-ink-muted)]">Search</div>
            <input
              className="to-input h-8 text-xs w-[min(320px,60vw)]"
              placeholder="tech id, name, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className={cls(
                "to-btn h-8 px-3 text-xs",
                stageAll ? "to-btn--primary" : "to-btn--secondary"
              )}
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
              {isSaving ? "Committing…" : "Commit changes"}
            </button>
          </div>
        </div>

        {saveMsg ? <div className="text-sm text-[var(--to-ink-muted)]">{saveMsg}</div> : null}
      </div>

      {/* Scroll container: header + body + footer */}
      <div className={cls("relative", "max-h-[calc(100vh-16rem)]", "overflow-auto")}>
        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-[var(--to-surface)] border-b border-[var(--to-border)]">
          <DataTable layout="fixed" gridStyle={gridStyle}>
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
            </DataTableHeader>
          </DataTable>
        </div>

        {/* Body */}
        <DataTable layout="fixed" gridStyle={gridStyle}>
          <DataTableBody zebra>
            {viewRows.map((r) => {
              const isAllOff = allDaysOff(r.days);
              const btnLabel = isAllOff ? "Add" : "Remove";

              const daysOn = Object.values(r.days).reduce((acc, v) => acc + (v ? 1 : 0), 0);
              const hours = daysOn * defaults.hoursPerDay;
              const units = hours * defaults.unitsPerHour;

              return (
                <DataTableRow key={r.assignmentId} gridStyle={gridStyle} className="items-center">
                  <div className="whitespace-nowrap">{r.techId}</div>

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
                    >
                      {btnLabel}
                    </button>
                  </div>

                  <div className="flex items-center">
                    <select
                      className="to-select h-8 text-xs"
                      value={r.routeId}
                      onChange={(e) => setRoute(r.assignmentId, e.target.value)}
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

                  <div className="whitespace-nowrap text-sm">
                    {daysOn} days • {Math.round(units)} units • {hours.toFixed(0)} hours
                  </div>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>

        {/* Sticky footer (totals row) */}
        <div className="sticky bottom-0 z-20 bg-[var(--to-surface)] border-t border-[var(--to-border)]">
          <DataTableRow gridStyle={gridStyle} className="items-center">
            <div className="whitespace-nowrap font-medium"></div>
            <div className="min-w-0 font-medium"></div>
            <div className="whitespace-nowrap font-medium"></div>
            <div className="min-w-0 font-medium">Scheduled Totals</div>

            {DAYS.map((d) => (
              <div key={d.key} className="text-center">
                <span className="text-sm font-medium">{totals.perDay[d.key]}</span>
              </div>
            ))}

            <div />
          </DataTableRow>
        </div>
      </div>
    </Card>
  );
}