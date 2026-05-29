"use client";

import React from "react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

import type { MonthItem, RouteItem } from "../hooks/useQuotaAdminData";
import { DAYS, DAY_KEYS, sumRowHours, toInt, type DayKey, type WriteRow } from "../lib/quotaMath";

type DisplayMode = "hours" | "units" | "techs";

function hoursToUnits(hours: number) {
  return hours * 12;
}
function hoursToTechs(hours: number) {
  return Math.ceil(hours / 8);
}
function hoursToHeadcount(hours: number) {
  return hours / 40;
}
function displayValue(mode: DisplayMode, hours: number) {
  if (mode === "hours") return hours;
  if (mode === "units") return hoursToUnits(hours);
  return hoursToTechs(hours);
}

function fiscalShortFromLabel(label: string) {
  const m = String(label ?? "")
    .trim()
    .match(/^FY(\d{4})\s+([A-Za-z]+)/);
  if (!m) return String(label ?? "").trim() || "—";
  const yy = m[1].slice(-2);
  const mon = m[2].slice(0, 3);
  return `FY${yy} ${mon}`;
}

function writeRowTotals(r: WriteRow) {
  const hours = sumRowHours(r);
  const units = hoursToUnits(hours);
  const techs = DAY_KEYS.reduce((acc, k) => acc + hoursToTechs(toInt(r[k])), 0);
  return { hours, units, techs };
}

type Totals = {
  dayHours: Record<DayKey, number>;
  totalHours: number;
  totalUnits: number;
  techDays: number;
};

type RowsByRoute = Array<
  {
    route_id: string;
    route_name: string;
  } & Record<DayKey, number>
>;

type Props = {
  status: {
    loading: boolean;
    saving: boolean;
    err: string | null;
    notice: string | null;
  };

  lookups: {
    routes: RouteItem[];
    months: MonthItem[];
  };

  read: {
    selectedMonthId: string;
    setSelectedMonthId: (v: string) => void;
    mode: DisplayMode;
    setMode: (v: DisplayMode) => void;
    rowsByRoute: RowsByRoute;
    totals: Totals;
    selectedMonth: MonthItem | null;
    onRefreshLookups: () => void;
  };

  write: {
    canWriteQuota: boolean;
    writeMonthId: string;
    setWriteMonthId: (v: string) => void;
    writeRows: WriteRow[];
    setWriteRows: (next: WriteRow[] | ((prev: WriteRow[]) => WriteRow[])) => void;
    onAddWriteRow: () => void;
    onClearWrite: () => void;
    onSaveRows: () => void;
  };
};

export function QuotaAdminView(props: Props) {
  const { status, lookups, read, write } = props;
  const { loading, saving, err, notice } = status;
  const { routes, months } = lookups;
  const headcount = hoursToHeadcount(read.totals.totalHours);

  return (
    <div className="mx-auto max-w-[1200px] p-4">
      <Card>
        <div className="flex items-center gap-3">
          <Button variant="secondary">
            <Link href="/route-lock">Back</Link>
          </Button>

          <div>
            <div className="text-sm font-semibold">Quota</div>
            <div className="text-xs text-[var(--to-ink-muted)]">Route Lock • Monthly quota targets by route</div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/route-lock/quota/history">
              <Button variant="secondary" className="h-8 px-3 text-xs" disabled={loading || saving}>
                History
              </Button>
            </Link>

            <Button
              variant="secondary"
              className="h-8 px-3 text-xs"
              onClick={read.onRefreshLookups}
              disabled={loading || saving}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {err ? (
        <Card className="mt-3">
          <div className="text-sm font-semibold text-[var(--to-status-danger)]">Quota error</div>
          <div className="text-sm text-[var(--to-ink-muted)]">{err}</div>
        </Card>
      ) : null}

      {notice ? (
        <Card className="mt-3">
          <div className="text-sm font-semibold">Success</div>
          <div className="text-sm text-[var(--to-ink-muted)]">{notice}</div>
        </Card>
      ) : null}

      <Card className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold mr-2">Quota</div>

          <Select
            value={read.selectedMonthId}
            onChange={(e) => read.setSelectedMonthId(e.target.value)}
            className="w-60"
            disabled={months.length === 0 || !write.canWriteQuota}
          >
            {months.length === 0 ? <option value="">No months</option> : null}
            {months.map((m) => (
              <option key={m.fiscal_month_id} value={m.fiscal_month_id}>
                {fiscalShortFromLabel(m.label)}
              </option>
            ))}
          </Select>

          <SegmentedControl
            value={read.mode}
            onChange={(v) => read.setMode(v as DisplayMode)}
            size="sm"
            options={[
              { value: "hours", label: "Hours" },
              { value: "units", label: "Units" },
              { value: "techs", label: "Tech-Days" },
            ]}
          />

          <div className="ml-auto flex items-center gap-3 text-xs text-[var(--to-ink-muted)]">
            <span>
              Routes w/ Quota: <span className="text-[var(--to-ink)]">{read.rowsByRoute.length}</span>
            </span>
            <span>
              Routes: <span className="text-[var(--to-ink)]">{routes.length}</span>
            </span>
            <span>
              Hours: <span className="text-[var(--to-ink)]">{read.totals.totalHours}</span>
            </span>
            <span>
              Units: <span className="text-[var(--to-ink)]">{read.totals.totalUnits}</span>
            </span>
            <span>
              Tech-Days: <span className="text-[var(--to-ink)]">{read.totals.techDays}</span>
            </span>
            <span>
              Headcount: <span className="text-[var(--to-ink)]">{headcount}</span>
            </span>
          </div>
        </div>

        <div className="mt-3 overflow-auto rounded border border-[var(--to-border)]">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-[var(--to-surface-2)]">
              <tr>
                <th className="text-left p-2 w-56">Route</th>
                {DAYS.map((d) => (
                  <th key={d.key} className="text-right p-2">
                    {d.label}
                  </th>
                ))}
                <th className="text-right p-2">Weekly</th>
              </tr>
            </thead>

            <tbody>
              <tr className="border-t border-[var(--to-border)]">
                <td className="p-2 text-[var(--to-ink-muted)]">Totals</td>
                {DAYS.map((d) => (
                  <td key={d.key} className="p-2 text-right">
                    {displayValue(read.mode, read.totals.dayHours[d.key] ?? 0)}
                  </td>
                ))}
                <td className="p-2 text-right">{displayValue(read.mode, read.totals.totalHours)}</td>
              </tr>

              {read.rowsByRoute.length === 0 ? (
                <tr className="border-t border-[var(--to-border)]">
                  <td colSpan={9} className="p-3 text-[var(--to-ink-muted)]">
                    No routes with quota for this month.
                  </td>
                </tr>
              ) : null}

              {read.rowsByRoute.map((r) => {
                const weekly = sumRowHours(r);
                return (
                  <tr key={r.route_id} className="border-t border-[var(--to-border)]">
                    <td className="p-2 font-medium">{r.route_name}</td>
                    {DAYS.map((d) => (
                      <td key={d.key} className="p-2 text-right">
                        {displayValue(read.mode, toInt(r[d.key]))}
                      </td>
                    ))}
                    <td className="p-2 text-right">{displayValue(read.mode, weekly)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-xs text-[var(--to-ink-muted)]">
          Showing {read.rowsByRoute.length} route(s) for{" "}
          {read.selectedMonth ? fiscalShortFromLabel(read.selectedMonth.label) : "—"}. Tech-Days are derived as{" "}
          <b>ceil(hours / 8)</b> per day. Headcount is derived from <b>total hours / 40</b> for the selected fiscal
          month.
        </div>
      </Card>

      <Card className="mt-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">{write.canWriteQuota ? "Write" : "Read-only access"}</div>
          <div className="text-xs text-[var(--to-ink-muted)]">
            {write.canWriteQuota
              ? "Block upsert grid (add rows + commit)"
              : "Quota editing requires route_lock_manage permission."}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              className="h-8 px-3 text-xs"
              onClick={write.onAddWriteRow}
              disabled={!write.canWriteQuota}
            >
              Add row
            </Button>
            <Button
              variant="secondary"
              className="h-8 px-3 text-xs"
              onClick={write.onClearWrite}
              disabled={!write.canWriteQuota}
            >
              Clear
            </Button>
            <Button
              variant="secondary"
              className="h-8 px-3 text-xs"
              onClick={write.onSaveRows}
              disabled={!write.canWriteQuota || saving || loading || !write.writeMonthId}
            >
              {saving ? "Saving..." : "Save rows"}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="text-xs text-[var(--to-ink-muted)]">Fiscal month</div>
          <Select
            value={write.writeMonthId}
            onChange={(e) => write.setWriteMonthId(e.target.value)}
            className="w-60"
            disabled={months.length === 0}
          >
            {months.length === 0 ? <option value="">No months</option> : null}
            {months.map((m) => (
              <option key={m.fiscal_month_id} value={m.fiscal_month_id}>
                {fiscalShortFromLabel(m.label)}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-3 overflow-auto rounded border border-[var(--to-border)]">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-[var(--to-surface-2)]">
              <tr>
                <th className="text-left p-2 w-64">Route</th>
                {DAYS.map((d) => (
                  <th key={d.key} className="text-right p-2">
                    {d.label} (hrs)
                  </th>
                ))}
                <th className="text-right p-2">Weekly</th>
                <th className="text-right p-2" />
              </tr>
            </thead>
            <tbody>
              {write.writeRows.map((r, idx) => {
                const t = writeRowTotals(r);
                return (
                  <tr key={idx} className="border-t border-[var(--to-border)]">
                    <td className="p-2">
                      <Select
                        value={r.route_id}
                        onChange={(e) => {
                          const v = e.target.value;
                          write.setWriteRows((prev) => prev.map((x, i) => (i === idx ? { ...x, route_id: v } : x)));
                        }}
                        disabled={routes.length === 0 || !write.canWriteQuota}
                        className="w-56"
                      >
                        <option value="">Select a route...</option>
                        {routes.map((rt) => (
                          <option key={rt.route_id} value={rt.route_id}>
                            {rt.route_name}
                          </option>
                        ))}
                      </Select>
                      <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                        Units: {t.units} • Tech-Days: {t.techs}
                      </div>
                    </td>

                    {DAYS.map((d) => (
                      <td key={d.key} className="p-2 text-right">
                        <input
                          className="h-9 w-20 rounded border border-[var(--to-border)] px-2 text-right"
                          value={r[d.key]}
                          inputMode="numeric"
                          disabled={!write.canWriteQuota}
                          onChange={(e) => {
                            const v = toInt(e.target.value);
                            write.setWriteRows((prev) => prev.map((x, i) => (i === idx ? { ...x, [d.key]: v } : x)));
                          }}
                        />
                      </td>
                    ))}

                    <td className="p-2 text-right font-medium">{t.hours}</td>

                    <td className="p-2 text-right">
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => write.setWriteRows((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={!write.canWriteQuota || write.writeRows.length <= 1}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-xs text-[var(--to-ink-muted)]">
          Writes to <code>public.quota</code>. DB-generated fields (<code>qu_*</code>, <code>qt_hours</code>,{" "}
          <code>qt_units</code>) are derived from <code>qh_*</code>. Tech-Days are UI-only (whole tech-days via{" "}
          <b>ceil(hours / 8)</b>).
        </div>
      </Card>
    </div>
  );
}