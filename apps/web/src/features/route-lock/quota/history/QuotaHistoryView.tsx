"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

import type { MonthItem, QuotaMonthlySummaryRow, QuotaRow } from "../hooks/useQuotaAdminData";
import { sumRowHours, toInt, type DayKey } from "../lib/quotaMath";

type DisplayMode = "hours" | "units" | "techs";

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "qh_sun", label: "Sun" },
  { key: "qh_mon", label: "Mon" },
  { key: "qh_tue", label: "Tue" },
  { key: "qh_wed", label: "Wed" },
  { key: "qh_thu", label: "Thu" },
  { key: "qh_fri", label: "Fri" },
  { key: "qh_sat", label: "Sat" },
];

function hoursToUnits(hours: number) {
  return hours * 12;
}

function hoursToTechs(hours: number) {
  return Math.ceil(hours / 8);
}

function hoursToHeadcount(hours: number) {
  return hours / 40;
}

function roundedHeadcount(hours: number) {
  return Math.ceil(hours / 40);
}

function rampSignal(delta: number | null) {
  if (delta == null || delta === 0) return "—";
  return delta > 0 ? "↑" : "↓";
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

function monthKeyFromRow(r: QuotaRow) {
  return r.fiscal_month_id || r.fiscal_month_key || r.fiscal_month_label;
}

function fiscalShortFromRow(r: Pick<QuotaRow, "fiscal_month_label">) {
  return fiscalShortFromLabel(r.fiscal_month_label);
}

type Props = {
  status: {
    loading: boolean;
    saving: boolean;
    err: string | null;
    notice: string | null;
  };

  months: MonthItem[];

  mode: DisplayMode;
  setMode: (v: DisplayMode) => void;

  history: {
    historyMonthId: string;
    setHistoryMonthId: (v: string) => void;
    historyQuery: string;
    setHistoryQuery: (v: string) => void;
    filteredHistoryRows: QuotaRow[];
    monthlySummary: QuotaMonthlySummaryRow[];
    onRefreshHistory: () => void;
  };
};

export function QuotaHistoryView(props: Props) {
  const { status, months, mode, setMode, history } = props;
  const { loading, saving, err, notice } = status;
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);

  const monthlySummary = useMemo(() => {
    const detailRowsByMonth = new Map<string, QuotaRow[]>();
    for (const row of history.filteredHistoryRows) {
      const key = monthKeyFromRow(row);
      const list = detailRowsByMonth.get(key) ?? [];
      list.push(row);
      detailRowsByMonth.set(key, list);
    }

    const query = history.historyQuery.trim().toLowerCase();

    return history.monthlySummary
      .filter((m) => {
        if (history.historyMonthId && m.fiscal_month_id !== history.historyMonthId) return false;
        if (!query) return true;

        const rows = detailRowsByMonth.get(m.fiscal_month_id) ?? [];
        const hay = [
          m.fiscal_month_key,
          m.fiscal_month_label,
          fiscalShortFromLabel(String(m.fiscal_month_label ?? "")),
          ...rows.map((r) => r.route_name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return hay.includes(query);
      })
      .map((m) => ({
        monthId: m.fiscal_month_id,
        label: fiscalShortFromLabel(String(m.fiscal_month_label ?? m.fiscal_month_key ?? "")),
        rows: detailRowsByMonth.get(m.fiscal_month_id) ?? [],
        routesWithQuota: m.route_count,
        totalHours: m.total_hours,
        totalUnits: m.total_units,
        techDays: m.tech_days,
        headcount: roundedHeadcount(m.total_hours),
        headcountDeltaMom:
          m.hours_delta_mom == null
            ? null
            : roundedHeadcount(m.total_hours) - roundedHeadcount(m.total_hours - m.hours_delta_mom),
        hoursDeltaMom: m.hours_delta_mom,
      }));
  }, [history.filteredHistoryRows, history.historyMonthId, history.historyQuery, history.monthlySummary]);

  return (
    <div className="mx-auto max-w-[1200px] p-4">
      <Card>
        <div className="flex items-center gap-3">
          <Link href="/route-lock/quota">
            <Button variant="secondary">Back</Button>
          </Link>

          <div>
            <div className="text-sm font-semibold">Quota History</div>
            <div className="text-xs text-[var(--to-ink-muted)]">Monthly quota summary with route detail drilldown</div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              className="h-8 px-3 text-xs"
              onClick={history.onRefreshHistory}
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
          <div className="text-sm font-semibold">Monthly Summary</div>

          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as DisplayMode)}
            size="sm"
            options={[
              { value: "hours", label: "Hours" },
              { value: "units", label: "Units" },
              { value: "techs", label: "Tech-Days" },
            ]}
          />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              value={history.historyMonthId}
              onChange={(e) => history.setHistoryMonthId(e.target.value)}
              className="w-48"
              disabled={months.length === 0}
            >
              <option value="">All months</option>
              {months.map((m) => (
                <option key={m.fiscal_month_id} value={m.fiscal_month_id}>
                  {fiscalShortFromLabel(m.label)}
                </option>
              ))}
            </Select>

            <TextInput
              value={history.historyQuery}
              onChange={(e) => history.setHistoryQuery(e.target.value)}
              placeholder="Search route or month..."
              className="w-56"
            />
          </div>
        </div>

        <div className="mt-3 overflow-auto rounded border border-[var(--to-border)]">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-[var(--to-surface-2)]">
              <tr>
                <th className="text-left p-2 w-32">Month</th>
                <th className="text-right p-2">Routes</th>
                <th className="text-right p-2">Hours</th>
                <th className="text-right p-2">Units</th>
                <th className="text-right p-2">Δ Hours MoM</th>
                <th className="text-right p-2">Tech-Days</th>
                <th className="text-right p-2">Headcount</th>
                <th className="text-right p-2">Ramp</th>
                <th className="text-right p-2 w-32">Detail</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.length === 0 ? (
                <tr className="border-t border-[var(--to-border)]">
                  <td colSpan={9} className="p-3 text-[var(--to-ink-muted)]">
                    No quota history yet.
                  </td>
                </tr>
              ) : null}

              {monthlySummary.map((m) => {
                const expanded = expandedMonthId === m.monthId;

                return (
                  <React.Fragment key={m.monthId}>
                    <tr className="border-t border-[var(--to-border)]">
                      <td className="p-2 font-medium whitespace-nowrap">{m.label}</td>
                      <td className="p-2 text-right">{m.routesWithQuota}</td>
                      <td className="p-2 text-right">{m.totalHours}</td>
                      <td className="p-2 text-right">{m.totalUnits}</td>
                      <td
                        className={[
                          "p-2 text-right font-medium",
                          m.hoursDeltaMom == null
                            ? "text-[var(--to-ink-muted)]"
                            : m.hoursDeltaMom > 0
                              ? "text-[var(--to-status-success)]"
                              : m.hoursDeltaMom < 0
                                ? "text-[var(--to-status-danger)]"
                                : "text-[var(--to-ink-muted)]",
                        ].join(" ")}
                      >
                        {m.hoursDeltaMom == null ? "—" : `${m.hoursDeltaMom > 0 ? "+" : ""}${m.hoursDeltaMom}`}
                      </td>
                      <td className="p-2 text-right">{m.techDays}</td>
                      <td className="p-2 text-right">{m.headcount}</td>
                      <td className="p-2 text-right">
                        <span
                          className={[
                            "inline-flex min-w-[58px] items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                            m.headcountDeltaMom == null || m.headcountDeltaMom === 0
                              ? "border-[var(--to-border)] bg-[var(--to-surface-2)] text-[var(--to-ink-muted)]"
                              : m.headcountDeltaMom > 0
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-red-200 bg-red-50 text-red-700",
                          ].join(" ")}
                          title={
                            m.headcountDeltaMom == null
                              ? "No prior month"
                              : `Headcount demand change MoM: ${m.headcountDeltaMom > 0 ? "+" : ""}${m.headcountDeltaMom}`
                          }
                        >
                          {rampSignal(m.headcountDeltaMom)}
                          {m.headcountDeltaMom == null || m.headcountDeltaMom === 0
                            ? ""
                            : ` ${m.headcountDeltaMom > 0 ? "+" : ""}${m.headcountDeltaMom}`}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => setExpandedMonthId(expanded ? null : m.monthId)}
                        >
                          {expanded ? "Hide" : "View"}
                        </Button>
                      </td>
                    </tr>

                    {expanded ? (
                      <tr className="border-t border-[var(--to-border)] bg-[var(--to-surface-2)]">
                        <td colSpan={9} className="p-0">
                          <div className="overflow-auto p-3">
                            <table className="min-w-[980px] w-full text-xs">
                              <thead>
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
                                {m.rows.map((r, i) => (
                                  <tr key={`${r.quota_id}-${i}`} className="border-t border-[var(--to-border)]">
                                    <td className="p-2 font-medium">{r.route_name}</td>
                                    {DAYS.map((d) => (
                                      <td key={d.key} className="p-2 text-right">
                                        {displayValue(mode, toInt((r as Record<DayKey, unknown>)[d.key]))}
                                      </td>
                                    ))}
                                    <td className="p-2 text-right font-semibold">
                                      {displayValue(mode, sumRowHours(r as any))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-xs text-[var(--to-ink-muted)]">
          Summary is grouped by fiscal month. Tech-Days are derived as <b>ceil(hours / 8)</b> per day. Headcount is{" "}
          rounded up from <b>total hours / 40</b>. Ramp signals MoM headcount demand change.
        </div>
      </Card>
    </div>
  );
}
