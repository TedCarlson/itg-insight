"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";

type Day = {
  date: string;
  quota_hours: number | null;
  quota_routes: number | null;
  bplow_count: number;
  has_sv: boolean;
  actual_routes: number | null;
  actual_hours: number | null;
  actual_tech_ids: string[];
  travel_tech_ids: string[];
};

type SummaryMetric = {
  label: string;
  value: number | null;
  kind: "count" | "hours" | "percent";
};

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoWeekNumber(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function displayDate(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
}

function sumAvailable(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value !== null);
  return available.length ? available.reduce((sum, value) => sum + value, 0) : null;
}

function formatMetric(metric: SummaryMetric): string {
  if (metric.value === null) return "—";
  if (metric.kind === "percent") return `${metric.value.toFixed(2)}%`;
  if (metric.kind === "hours") {
    return metric.value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return Math.round(metric.value).toLocaleString("en-US");
}

function exportMetric(metric: SummaryMetric): string {
  if (metric.value === null) return "";
  if (metric.kind === "percent") return `${metric.value.toFixed(2)}%`;
  if (metric.kind === "hours") return String(Math.round(metric.value * 10) / 10);
  return String(Math.round(metric.value));
}

export function RouteLockSevenDayClient(props: {
  days: Day[];
  weekStart: string;
  weekEnd: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);
  const weekNumber = isoWeekNumber(props.weekEnd);

  const metrics = useMemo<SummaryMetric[]>(() => {
    const routesNeeded = sumAvailable(props.days.map((day) => day.quota_routes));
    const routesActual = sumAvailable(props.days.map((day) => day.actual_routes));
    const forecastedHours = sumAvailable(props.days.map((day) => day.quota_hours));
    const completedHours = sumAvailable(props.days.map((day) => day.actual_hours));

    const actualTechIds = new Set(
      props.days.flatMap((day) => day.actual_tech_ids).filter(Boolean)
    );
    const borrowedTechIds = new Set(
      props.days.flatMap((day) => day.travel_tech_ids).filter(Boolean)
    );

    const hasBuiltData = props.days.some((day) => day.has_sv);
    const bpLow = hasBuiltData
      ? props.days.reduce((sum, day) => sum + day.bplow_count, 0)
      : null;

    const runRate =
      routesNeeded !== null && routesNeeded > 0 && routesActual !== null
        ? (routesActual / routesNeeded) * 100
        : null;

    return [
      { label: "Routes Needed", value: routesNeeded, kind: "count" },
      { label: "Routes Actual", value: routesActual, kind: "count" },
      { label: "BPLow", value: bpLow, kind: "count" },
      { label: "Run Rate %", value: runRate, kind: "percent" },
      { label: "Total Headcount", value: actualTechIds.size || null, kind: "count" },
      { label: "Techs Loaned", value: null, kind: "count" },
      { label: "Techs Borrowed", value: borrowedTechIds.size || null, kind: "count" },
      { label: "Forecasted Hours", value: forecastedHours, kind: "hours" },
      { label: "Completed Hours", value: completedHours, kind: "hours" },
    ];
  }, [props.days]);

  function navigateToWeek(weekEnding: string) {
    router.push(`${pathname}?weekEnding=${weekEnding}`);
  }

  async function copyForSpreadsheet() {
    const lines = metrics.map((metric) => exportMetric(metric));

    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm font-semibold">Lock Summary</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            Wk {weekNumber} · Week Ending {displayDate(props.weekEnd)}
          </div>
          <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
            Sunday {displayDate(props.weekStart)} through Saturday {displayDate(props.weekEnd)}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            className="to-btn to-btn--secondary h-9 px-3 text-xs"
            onClick={() => navigateToWeek(addDaysISO(props.weekEnd, -7))}
          >
            Previous Week
          </button>

          <label className="grid gap-1 text-[11px] text-[var(--to-ink-muted)]">
            Week ending
            <input
              type="date"
              min="1970-01-03"
              step={7}
              value={props.weekEnd}
              className="h-9 rounded-lg border border-[var(--to-border)] bg-[var(--to-surface)] px-3 text-xs text-[var(--to-ink)]"
              onChange={(event) => {
                const selectedDate = event.target.value;
                if (!selectedDate) return;
                if (new Date(`${selectedDate}T00:00:00Z`).getUTCDay() !== 6) return;
                navigateToWeek(selectedDate);
              }}
            />
          </label>

          <button
            type="button"
            className="to-btn to-btn--secondary h-9 px-3 text-xs"
            onClick={() => navigateToWeek(addDaysISO(props.weekEnd, 7))}
          >
            Next Week
          </button>

          <button
            type="button"
            className="to-btn h-9 px-3 text-xs"
            onClick={() => void copyForSpreadsheet()}
          >
            {copied ? "Copied" : "Copy for Spreadsheet"}
          </button>
        </div>
      </div>

      <div className="mt-5 max-w-2xl overflow-hidden rounded-xl border border-[var(--to-border)]">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[var(--to-surface-2)]">
            <tr>
              <th className="border-b border-r border-[var(--to-border)] px-4 py-3 text-left font-semibold">
                Forecast &amp; Lock
              </th>
              <th className="border-b border-[var(--to-border)] px-4 py-3 text-right font-semibold">
                WK{weekNumber}
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.label} className="border-b border-[var(--to-border)] last:border-b-0">
                <th className="border-r border-[var(--to-border)] px-4 py-3 text-left font-medium">
                  {metric.label}
                </th>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatMetric(metric)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[11px] text-[var(--to-ink-muted)]">
        Blank values copy as empty spreadsheet cells.
      </div>
    </Card>
  );
}
