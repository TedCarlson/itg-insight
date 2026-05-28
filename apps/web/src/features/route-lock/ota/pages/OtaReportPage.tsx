// path: apps/web/src/features/route-lock/ota/pages/OtaReportPage.tsx

"use client";

import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { OtaSummaryCards } from "../components/OtaSummaryCards";
import {
  OtaWeekDetailPanel,
  type OtaDetailFilter,
} from "../components/OtaWeekDetailPanel";
import { OtaWeekSummaryTable } from "../components/OtaWeekSummaryTable";
import type { OtaDayGroup, OtaPayload, OtaReportScope } from "../types";

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function todayInNY() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function filterDayGroups(groups: OtaDayGroup[], filter: OtaDetailFilter) {
  if (filter === "all") return groups;

  return groups
    .map((group) => {
      const rows = group.rows.filter((row) => {
        if (filter === "late") return row.status === "LATE";
        if (filter === "on_time") return row.status === "ON_TIME" || row.status === "GRACE";
        if (filter === "ineligible") return row.status === "INELIGIBLE" || row.status === "UNKNOWN";
        return true;
      });

      return { ...group, rows };
    })
    .filter((group) => group.rows.length > 0);
}

export default function OtaReportPage() {
  const [scope, setScope] = useState<OtaReportScope>("week");
  const [anchor, setAnchor] = useState(todayInNY());
  const [payload, setPayload] = useState<OtaPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const [filter, setFilter] = useState<OtaDetailFilter>("all");

  useEffect(() => {
    let alive = true;

    async function load() {
      setBusy(true);
      setError(null);

      try {
        const res = await fetch(`/api/route-lock/ota?scope=${scope}&anchor=${anchor}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok || json?.ok === false) {
          throw new Error(String(json?.error ?? "Failed to load OTA report"));
        }

        if (!alive) return;

        const nextPayload = json as OtaPayload;
        setPayload(nextPayload);
        setAnchor(nextPayload.anchor);
        setOpenWeek(nextPayload.weeks[nextPayload.weeks.length - 1]?.week_start ?? null);
      } catch (err: any) {
        if (!alive) return;
        setError(String(err?.message ?? "Failed to load OTA report"));
        setPayload(null);
      } finally {
        if (alive) setBusy(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [scope, anchor]);

  const openDayGroups = useMemo(() => {
    const week = payload?.weeks.find((item) => item.week_start === openWeek);
    return filterDayGroups(week?.day_groups ?? [], filter);
  }, [filter, openWeek, payload?.weeks]);

  function setScopeAndResetAnchor(nextScope: OtaReportScope) {
    setScope(nextScope);
    setAnchor(todayInNY());
    setFilter("all");
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--to-ink)]">OTA / TTFJ Report</h2>
            <p className="mt-1 text-sm text-[var(--to-ink-muted)]">
              Org-scoped first-job scan from check-in jobs. Week and month scopes are navigable for WoW/MoM review.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setScopeAndResetAnchor("week")}
              className={cls(
                "rounded-xl border px-3 py-2 text-sm font-semibold",
                scope === "week"
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-[var(--to-border)] bg-[var(--to-surface)] text-[var(--to-ink)]"
              )}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setScopeAndResetAnchor("month")}
              className={cls(
                "rounded-xl border px-3 py-2 text-sm font-semibold",
                scope === "month"
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-[var(--to-border)] bg-[var(--to-surface)] text-[var(--to-ink)]"
              )}
            >
              Month
            </button>

            <span className="mx-1 h-8 w-px bg-[var(--to-border)]" />

            <button
              type="button"
              disabled={!payload}
              onClick={() => payload && setAnchor(payload.window.previous_anchor)}
              className="rounded-xl border border-[var(--to-border)] bg-[var(--to-surface)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setAnchor(todayInNY())}
              className="rounded-xl border border-[var(--to-border)] bg-[var(--to-surface)] px-3 py-2 text-sm font-semibold"
            >
              Current
            </button>
            <button
              type="button"
              disabled={!payload}
              onClick={() => payload && setAnchor(payload.window.next_anchor)}
              className="rounded-xl border border-[var(--to-border)] bg-[var(--to-surface)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {error ? (
        <Card>
          <div className="text-sm font-semibold text-red-700">{error}</div>
        </Card>
      ) : null}

      <OtaSummaryCards payload={payload} />

      <OtaWeekSummaryTable
        payload={payload}
        busy={busy}
        openWeek={openWeek}
        onOpenWeek={(weekStart) => setOpenWeek((current) => (current === weekStart ? null : weekStart))}
      />

      {openWeek && payload ? (
        <OtaWeekDetailPanel
          dayGroups={openDayGroups}
          filter={filter}
          onFilterChange={setFilter}
        />
      ) : null}
    </div>
  );
}
