"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

type Week = {
  key: string;
  week_ending_date: string;
  base_label?: string;
  week_label: string;
  record_id: string | null;
  overall_performance: number | null;
  created_at?: string | null;
  as_of_at?: string | null;
  as_of_date?: string | null;
  is_latest?: boolean;
};

type Snapshot = {
  value: number;
  prior_week_value: number;
  current_week_trend: number;
  change_points: number;
  status: string;
};

type StateRow = {
  state: string;
  snapshots: Record<string, Snapshot>;
  latest_value: number | null;
  previous_value: number | null;
  movement_vs_prior_snapshot: number | null;
  direction: string;
  current_week_trend: number | null;
  latest_status: string | null;
  is_active_latest: boolean;
  weeks_tracked: number;
};

type Payload = {
  weeks: Week[];
  state_rows: StateRow[];
  summary: {
    latest_week: Week | null;
    active_states: number;
    historical_states: number;
    improved_count: number;
    declined_count: number;
    neutral_count: number;
    needs_attention_count: number;
    watch_closely_count: number;
  };
};

function pct(v: number | null | undefined) {
  return v == null ? "—" : `${v}%`;
}

function move(v: number | null | undefined) {
  if (v == null) return "—";
  if (v > 0) return `▲ +${v}`;
  if (v < 0) return `▼ ${v}`;
  return "— 0";
}

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function latestRowClass(status: string | null) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "needs attention") return "bg-red-700 text-white";
  if (normalized === "watch closely") return "bg-yellow-300 text-yellow-950";
  return "";
}

function cellClass(snapshot: Snapshot | undefined) {
  const status = String(snapshot?.status ?? "").toLowerCase();
  if (status === "needs attention") return "bg-red-700 text-white font-semibold";
  if (status === "watch closely") return "bg-yellow-300 text-yellow-950 font-semibold";
  return "";
}

function matrixText(payload: Payload) {
  const weeks = payload.weeks;
  const header = [
    "State",
    ...weeks.map((w) => w.week_label ?? w.week_ending_date),
    "Latest",
    "Δ vs Prior Snapshot",
    "Current Trend",
    "Status",
  ];

  const rows = payload.state_rows.map((row) => [
    row.state,
    ...weeks.map((week) => pct(row.snapshots[week.key ?? week.week_ending_date]?.value)),
    pct(row.latest_value),
    move(row.movement_vs_prior_snapshot),
    pct(row.current_week_trend),
    row.latest_status ?? "—",
  ]);

  return [header, ...rows].map((r) => r.join("\\t")).join("\\n");
}

function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

async function copyRichClipboard(args: { html: string; text: string }) {
  const clipboardItem = typeof ClipboardItem !== "undefined"
    ? new ClipboardItem({
        "text/html": new Blob([args.html], { type: "text/html" }),
        "text/plain": new Blob([args.text], { type: "text/plain" }),
      })
    : null;

  if (clipboardItem && navigator.clipboard?.write) {
    await navigator.clipboard.write([clipboardItem]);
    return;
  }

  await navigator.clipboard.writeText(args.text);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlCellStyle(snapshot: Snapshot | undefined) {
  const status = String(snapshot?.status ?? "").toLowerCase();

  if (status === "needs attention") {
    return "background:#b91c1c;color:#ffffff;font-weight:700;";
  }

  if (status === "watch closely") {
    return "background:#fde047;color:#422006;font-weight:700;";
  }

  return "";
}

function cotpMatrixHtml(payload: Payload) {
  const th =
    "border:1px solid #d1d5db;padding:8px;background:#f8fafc;color:#111827;font-weight:700;text-align:left;white-space:nowrap;";
  const td =
    "border:1px solid #d1d5db;padding:8px;color:inherit;white-space:nowrap;";
  const num = `${td}text-align:right;`;

  const headerWeeks = payload.weeks
    .map((week) => `<th style="${th}text-align:right;">${escapeHtml(week.week_label)}</th>`)
    .join("");

  const rows = payload.state_rows
    .map((row) => {
      const latestStyle = rowStyleForHtml(row.latest_status);

      const weekCells = payload.weeks
        .map((week) => {
          const snap = row.snapshots[week.key ?? week.week_ending_date];
          return `<td style="${num}${htmlCellStyle(snap)}">${escapeHtml(pct(snap?.value))}</td>`;
        })
        .join("");

      return `<tr style="${latestStyle}">
        <td style="${td}font-weight:700;">${escapeHtml(row.state)}</td>
        ${weekCells}
        <td style="${num}font-weight:700;">${escapeHtml(pct(row.latest_value))}</td>
        <td style="${num}font-weight:700;">${escapeHtml(move(row.movement_vs_prior_snapshot))}</td>
        <td style="${num}">${escapeHtml(pct(row.current_week_trend))}</td>
        <td style="${td}font-weight:700;">${escapeHtml(row.latest_status ?? "—")}</td>
      </tr>`;
    })
    .join("");

  return `<div style="font-family:Arial,sans-serif;color:#111827;">
    <h3 style="margin:0 0 8px 0;">COTP Weekly Snapshot Matrix</h3>
    <p style="margin:0 0 12px 0;color:#4b5563;">
      Latest Week: ${escapeHtml(payload.summary.latest_week?.week_label ?? "—")} |
      Overall: ${escapeHtml(pct(payload.summary.latest_week?.overall_performance))} |
      Improved: ${escapeHtml(payload.summary.improved_count)} |
      Declined: ${escapeHtml(payload.summary.declined_count)} |
      Needs Attention: ${escapeHtml(payload.summary.needs_attention_count)}
    </p>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;">
      <thead>
        <tr>
          <th style="${th}">State</th>
          ${headerWeeks}
          <th style="${th}text-align:right;">Latest</th>
          <th style="${th}text-align:right;">Δ</th>
          <th style="${th}text-align:right;">Current Trend</th>
          <th style="${th}">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function rowStyleForHtml(status: string | null) {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized === "needs attention") {
    return "background:#b91c1c;color:#ffffff;font-weight:700;";
  }

  if (normalized === "watch closely") {
    return "background:#fde047;color:#422006;font-weight:700;";
  }

  return "";
}

export function CotpProgressClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [range, setRange] = useState("CURRENT_WEEK");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const sp = new URLSearchParams();
        sp.set("range", range);

        const res = await fetch(`/api/locate/reporting-helper/progress/cotp?${sp.toString()}`);
        const json = await res.json();

        if (!res.ok) throw new Error(json.error ?? "Failed to load COTP progress");

        if (!cancelled) setPayload(json);
      } catch (error: any) {
        if (!cancelled) setErr(error?.message ?? "Failed to load progress");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [range]);

  const visibleRows = useMemo(() => {
    const rows = payload?.state_rows ?? [];
    const filter = stateFilter.trim().toUpperCase();
    if (!filter) return rows;
    return rows.filter((row) => row.state.includes(filter));
  }, [payload, stateFilter]);

  const latestWeek = payload?.summary.latest_week;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">COTP Progress</h2>
          <p className="text-sm text-[var(--to-ink-muted)]">
            Snapshot-over-snapshot COTP movement by state.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--to-border)" }}
          >
            <option value="CURRENT_WEEK">Current Week</option>
            <option value="ALL">All History</option>
            <option value="14D">Last 14 Days</option>
            <option value="30D">Last 30 Days</option>
          </select>

          <input
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            placeholder="Filter state..."
            className="rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--to-border)" }}
          />

          {payload ? (
            <button
              type="button"
              className="to-btn rounded-md border px-3 py-2 text-sm font-medium"
              style={{ borderColor: "var(--to-border)" }}
              onClick={() =>
                void copyRichClipboard({
                  html: cotpMatrixHtml(payload),
                  text: matrixText(payload),
                })
              }
            >
              Copy Matrix
            </button>
          ) : null}
        </div>
      </div>

      {err ? (
        <Card>
          <div className="text-sm text-[var(--to-danger)]">{err}</div>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <div className="text-sm text-[var(--to-ink-muted)]">Latest Week</div>
          <div className="mt-2 text-2xl font-semibold">
            {latestWeek?.week_label ?? "—"}
          </div>
        </Card>

        <Card>
          <div className="text-sm text-[var(--to-ink-muted)]">As Of</div>
          <div className="mt-2 text-2xl font-semibold">
            {latestWeek?.as_of_date ?? "—"}
          </div>
        </Card>

        <Card>
          <div className="text-sm text-[var(--to-ink-muted)]">Active States</div>
          <div className="mt-2 text-3xl font-semibold">
            {payload?.summary.active_states ?? "—"}
          </div>
        </Card>

        <Card>
          <div className="text-sm text-[var(--to-ink-muted)]">Up / Down / Neutral</div>
          <div className="mt-2 text-2xl font-semibold">
            {payload ? `${payload.summary.improved_count} / ${payload.summary.declined_count} / ${payload.summary.neutral_count}` : "—"}
          </div>
        </Card>

        <Card>
          <div className="text-sm text-[var(--to-ink-muted)]">Needs Attention</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--to-danger)]">
            {payload?.summary.needs_attention_count ?? "—"}
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-3">
          <div className="text-base font-semibold">Weekly Snapshot Matrix</div>
          <div className="text-sm text-[var(--to-ink-muted)]">
            Each week column represents the latest saved snapshot inside that week-ending bucket. Closed weeks display as Final; the latest bucket displays as As Of.
          </div>
        </div>

        <div className="overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}>
          <table className="w-full text-sm">
            <thead className="bg-[var(--to-surface-2)]">
              <tr className="text-left">
                <th className="sticky left-0 z-10 bg-[var(--to-surface-2)] px-3 py-2">
                  State
                </th>

                {(payload?.weeks ?? []).map((week) => (
                  <th key={week.key ?? week.week_ending_date} className="px-3 py-2 text-right">
                    {week.week_label}
                  </th>
                ))}

                <th className="px-3 py-2 text-right">Latest</th>
                <th className="px-3 py-2 text-right">Δ</th>
                <th className="px-3 py-2 text-right">Current Trend</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.length ? (
                visibleRows.map((row) => (
                  <tr
                    key={row.state}
                    className={cls("border-t", latestRowClass(row.latest_status))}
                    style={{ borderColor: "var(--to-border)" }}
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-semibold">
                      {row.state}
                      {!row.is_active_latest ? (
                        <span className="ml-2 text-xs font-normal opacity-70">(inactive)</span>
                      ) : null}
                    </td>

                    {(payload?.weeks ?? []).map((week) => {
                      const snap = row.snapshots[week.key ?? week.week_ending_date];

                      return (
                        <td
                          key={week.key ?? week.week_ending_date}
                          className={cls("px-3 py-2 text-right", cellClass(snap))}
                        >
                          {pct(snap?.value)}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2 text-right font-semibold">
                      {pct(row.latest_value)}
                    </td>

                    <td className="px-3 py-2 text-right font-semibold">
                      {move(row.movement_vs_prior_snapshot)}
                    </td>

                    <td className="px-3 py-2 text-right">
                      {row.direction ?? "—"}
                    </td>

                    <td className="px-3 py-2 font-semibold">
                      {row.latest_status ?? (row.is_active_latest ? "—" : "Inactive / no latest report")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={(payload?.weeks?.length ?? 0) + 5}
                    className="px-3 py-8 text-center text-sm text-[var(--to-ink-muted)]"
                  >
                    {loading ? "Loading..." : "No COTP progress records found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
