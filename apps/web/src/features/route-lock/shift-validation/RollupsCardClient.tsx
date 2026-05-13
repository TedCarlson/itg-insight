"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { ImportRow } from "./ImportedRowsCardClient";

function withinWindow(iso: string, today: string, maxDay: string) {
  return iso >= today && iso <= maxDay;
}

function dowShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  }).format(d);
}

function splitRouteAreas(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function fmtWhole(v: number) {
  return Math.round(v).toLocaleString();
}

function fmtHours(v: number) {
  return Number.isFinite(v) ? v.toFixed(1) : "—";
}

function UnitValue({
  value,
  presentCount,
}: {
  value: number;
  presentCount: number;
}) {
  if (presentCount <= 0) {
    return <span className="text-amber-700">Missing</span>;
  }

  return <>{fmtWhole(value)}</>;
}

export function RollupsCardClient({
  rows,
  today,
  maxDay,
}: {
  rows: ImportRow[];
  today: string;
  maxDay: string;
}) {
  const [day, setDay] = useState("");

  const activeDay = day && withinWindow(day, today, maxDay) ? day : "";

  const scopedRows = useMemo(() => {
    if (!activeDay) return rows;
    return rows.filter((r) => r.shift_date === activeDay);
  }, [rows, activeDay]);

  const dailyRollups = useMemo(() => {
    const map = new Map<
      string,
      {
        shift_date: string;
        rows: number;
        techs: Set<string>;
        builtUnits: number;
        targetUnits: number;
        totalHours: number;
        builtUnitRows: number;
        targetUnitRows: number;
        hourRows: number;
      }
    >();

    for (const r of scopedRows) {
      if (!map.has(r.shift_date)) {
        map.set(r.shift_date, {
          shift_date: r.shift_date,
          rows: 0,
          techs: new Set<string>(),
          builtUnits: 0,
          targetUnits: 0,
          totalHours: 0,
          builtUnitRows: 0,
          targetUnitRows: 0,
          hourRows: 0,
        });
      }

      const agg = map.get(r.shift_date)!;
      agg.rows += 1;

      if (r.tech_id) agg.techs.add(String(r.tech_id));

      if (isNum(r.work_units)) {
        agg.builtUnits += r.work_units;
        agg.builtUnitRows += 1;
      }

      if (isNum(r.target_unit)) {
        agg.targetUnits += r.target_unit;
        agg.targetUnitRows += 1;
      }

      if (isNum(r.shift_duration)) {
        agg.totalHours += r.shift_duration;
        agg.hourRows += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.shift_date.localeCompare(b.shift_date));
  }, [scopedRows]);

  const routeAreaModel = useMemo(() => {
    const windowTechs = new Set<string>();
    let windowRows = 0;
    let windowBuiltUnits = 0;
    let windowTargetUnits = 0;
    let windowTotalHours = 0;
    let windowBuiltUnitRows = 0;
    let windowTargetUnitRows = 0;

    const distinctRouteAreas = new Set<string>();
    const raMap = new Map<
      string,
      {
        route_area: string;
        rows: number;
        techs: Set<string>;
        builtUnits: number;
        targetUnits: number;
        totalHours: number;
        builtUnitRows: number;
        targetUnitRows: number;
      }
    >();

    for (const r of scopedRows) {
      windowRows += 1;

      if (r.tech_id) windowTechs.add(String(r.tech_id));

      if (isNum(r.work_units)) {
        windowBuiltUnits += r.work_units;
        windowBuiltUnitRows += 1;
      }

      if (isNum(r.target_unit)) {
        windowTargetUnits += r.target_unit;
        windowTargetUnitRows += 1;
      }

      if (isNum(r.shift_duration)) {
        windowTotalHours += r.shift_duration;
      }

      const areas = splitRouteAreas(r.route_areas);
      for (const a of areas) distinctRouteAreas.add(a);

      for (const area of areas) {
        if (!raMap.has(area)) {
          raMap.set(area, {
            route_area: area,
            rows: 0,
            techs: new Set<string>(),
            builtUnits: 0,
            targetUnits: 0,
            totalHours: 0,
            builtUnitRows: 0,
            targetUnitRows: 0,
          });
        }

        const agg = raMap.get(area)!;
        agg.rows += 1;

        if (r.tech_id) agg.techs.add(String(r.tech_id));

        if (isNum(r.work_units)) {
          agg.builtUnits += r.work_units;
          agg.builtUnitRows += 1;
        }

        if (isNum(r.target_unit)) {
          agg.targetUnits += r.target_unit;
          agg.targetUnitRows += 1;
        }

        if (isNum(r.shift_duration)) {
          agg.totalHours += r.shift_duration;
        }
      }
    }

    const routeAreaRollups = Array.from(raMap.values()).sort((a, b) => {
      if (b.builtUnits !== a.builtUnits) return b.builtUnits - a.builtUnits;
      return a.route_area.localeCompare(b.route_area);
    });

    return {
      windowRows,
      windowTechs,
      windowBuiltUnits,
      windowTargetUnits,
      windowTotalHours,
      windowBuiltUnitRows,
      windowTargetUnitRows,
      distinctRouteAreas,
      routeAreaRollups,
    };
  }, [scopedRows]);

  return (
    <Card>
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Daily rollup</div>
              <div className="text-xs text-[var(--to-ink-muted)]">
                Built units come from Shift Validation work_units. Missing means the upload row did not carry unit values.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={day}
                min={today}
                max={maxDay}
                onChange={(e) => setDay(e.target.value)}
                className="h-8 rounded-md border border-[color:var(--to-border)] bg-transparent px-2 text-xs"
              />

              {activeDay ? (
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setDay("")}>
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--to-ink-muted)]">
                <tr className="border-b">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">DOW</th>
                  <th className="py-2 pr-4">Techs Built</th>
                  <th className="py-2 pr-4">Built Units</th>
                  <th className="py-2 pr-4">Total Hours</th>
                </tr>
              </thead>

              <tbody>
                {dailyRollups.length === 0 ? (
                  <tr>
                    <td className="py-6 text-[var(--to-ink-muted)]" colSpan={5}>
                      No rows to roll up{activeDay ? ` for ${activeDay}.` : " in the current window."}
                    </td>
                  </tr>
                ) : (
                  dailyRollups.map((d) => (
                    <tr key={d.shift_date} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{d.shift_date}</td>
                      <td className="py-2 pr-4">{dowShort(d.shift_date)}</td>
                      <td className="py-2 pr-4">{d.techs.size}</td>
                      <td className="py-2 pr-4 font-medium">
                        <UnitValue value={d.builtUnits} presentCount={d.builtUnitRows} />
                      </td>
                      <td className="py-2 pr-4">{fmtHours(d.totalHours)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-[color:var(--to-border)]">
          <div className="text-sm font-medium">Route Areas rollup</div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="text-left text-[var(--to-ink-muted)]">
                <tr className="border-b">
                  <th className="py-2 pr-4 w-[38%]">Route Area</th>
                  <th className="py-2 pr-4 w-[15%]">Techs Built</th>
                  <th className="py-2 pr-4 w-[16%]">Built Units</th>
                  <th className="py-2 pr-4 w-[16%]">Target Units</th>
                  <th className="py-2 pr-4 w-[15%]">Total Hours</th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-b bg-black/5">
                  <td className="py-2 pr-4 font-medium truncate">{routeAreaModel.distinctRouteAreas.size}</td>
                  <td className="py-2 pr-4 font-medium">{routeAreaModel.windowTechs.size}</td>
                  <td className="py-2 pr-4 font-medium">
                    <UnitValue value={routeAreaModel.windowBuiltUnits} presentCount={routeAreaModel.windowBuiltUnitRows} />
                  </td>
                  <td className="py-2 pr-4 font-medium">
                    <UnitValue value={routeAreaModel.windowTargetUnits} presentCount={routeAreaModel.windowTargetUnitRows} />
                  </td>
                  <td className="py-2 pr-4 font-medium">{fmtHours(routeAreaModel.windowTotalHours)}</td>
                </tr>

                {routeAreaModel.routeAreaRollups.length === 0 ? (
                  <tr>
                    <td className="py-6 text-[var(--to-ink-muted)]" colSpan={5}>
                      No route area rows{activeDay ? ` for ${activeDay}.` : " in the current window."}
                    </td>
                  </tr>
                ) : (
                  routeAreaModel.routeAreaRollups.slice(0, 50).map((ra) => (
                    <tr key={ra.route_area} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 truncate">{ra.route_area}</td>
                      <td className="py-2 pr-4">{ra.techs.size}</td>
                      <td className="py-2 pr-4 font-medium">
                        <UnitValue value={ra.builtUnits} presentCount={ra.builtUnitRows} />
                      </td>
                      <td className="py-2 pr-4">
                        <UnitValue value={ra.targetUnits} presentCount={ra.targetUnitRows} />
                      </td>
                      <td className="py-2 pr-4">{fmtHours(ra.totalHours)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {routeAreaModel.routeAreaRollups.length > 50 ? (
            <div className="text-xs text-[var(--to-ink-muted)]">Showing top 50 route areas by Built Units.</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}