// path: apps/web/src/features/route-lock/history/pages/TechRouteHistoryPage.tsx

"use client";

import { useMemo, useState } from "react";
import { PageShell, PageHeader } from "@/components/ui/PageShell";

import HistoryFiltersCard from "../components/HistoryFiltersCard";
import HistoryCheckInWeeklyCard from "../components/HistoryCheckInWeeklyCard";

import { useTechHistorySearch } from "../hooks/useTechHistorySearch";
import { useTechHistoryData } from "../hooks/useTechHistoryData";

import type { TechSearchItem } from "../lib/history.types";

type Props = {
  shellRole?: "BP_OWNER";
  apiBasePath?: string;
  searchApiBasePath?: string;
};

type TechSearchItemWithBpAccess = TechSearchItem & {
  is_bp_affiliate?: boolean;
};

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateOnly: string, days: number) {
  const d = new Date(`${dateOnly}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

function lastCompletedSaturday() {
  const d = new Date();
  const day = d.getDay();
  const daysSinceSaturday = day === 6 ? 7 : day + 1;
  d.setDate(d.getDate() - daysSinceSaturday);
  return toDateOnly(d);
}

function weekStartFromSaturday(weekEndingSaturday: string) {
  return addDays(weekEndingSaturday, -6);
}

function isBpOwnerBlockedSelection(args: {
  shellRole?: "BP_OWNER";
  selectedTech: TechSearchItem | null;
}) {
  if (args.shellRole !== "BP_OWNER") return false;
  if (!args.selectedTech) return false;

  const selected = args.selectedTech as TechSearchItemWithBpAccess;

  return selected.is_bp_affiliate !== true;
}

export default function TechRouteHistoryPage(props: Props) {
  const defaultWeekEnding = lastCompletedSaturday();

  const [techQuery, setTechQuery] = useState("");
  const [fromDate, setFromDate] = useState(
    weekStartFromSaturday(defaultWeekEnding),
  );
  const [toDate, setToDate] = useState(defaultWeekEnding);
  const [selectedTech, setSelectedTech] = useState<TechSearchItem | null>(null);

  const apiBasePath = props.apiBasePath ?? "/api/route-lock/history";
  const searchApiBasePath = props.searchApiBasePath ?? apiBasePath;

  const {
    canSearch,
    searchOpen,
    setSearchOpen,
    searchBusy,
    searchError,
    setSearchError,
    searchItems,
    setSearchItems,
  } = useTechHistorySearch(techQuery, {
    apiBasePath: searchApiBasePath,
  });

  const blockedByBpAffiliation = isBpOwnerBlockedSelection({
    shellRole: props.shellRole,
    selectedTech,
  });

  const selectedTechForReport = blockedByBpAffiliation ? null : selectedTech;

  const {
    historyBusy,
    historyError,
    history,
    checkInBusy,
    checkInError,
    checkIn,
  } = useTechHistoryData(
    {
      selectedTech: selectedTechForReport,
      fromDate,
      toDate,
    },
    {
      apiBasePath,
    },
  );

  const selectedTechLabel = useMemo(() => {
    if (!selectedTechForReport) return null;
    return `${selectedTechForReport.full_name} • ${selectedTechForReport.tech_id}`;
  }, [selectedTechForReport]);

  const selectedAffiliation = useMemo(() => {
    return checkIn?.tech?.affiliation ?? selectedTechForReport?.co_name ?? null;
  }, [checkIn?.tech?.affiliation, selectedTechForReport?.co_name]);

  function onPickTech(item: TechSearchItem) {
    setSelectedTech(item);
    setTechQuery(`${item.full_name} • ${item.tech_id}`);
    setSearchItems([]);
    setSearchOpen(false);
    setSearchError(null);
  }

  function onClearTech() {
    setSelectedTech(null);
    setTechQuery("");
    setSearchItems([]);
    setSearchOpen(false);
    setSearchError(null);
  }

  function onClearedSelectionByTyping() {
    setSelectedTech(null);
  }

  return (
    <PageShell>
      <PageHeader
        title="Tech Route History"
        subtitle="One-week technician route and check-in review with daily production, SLA signals, and job-level drilldown."
      />

      {props.shellRole ? (
        <div
          id="shell-role-hint"
          data-shell-role={props.shellRole}
          className="hidden"
        />
      ) : null}

      <div className="space-y-4">
        <HistoryFiltersCard
          techQuery={techQuery}
          setTechQuery={setTechQuery}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          selectedTech={selectedTech}
          onPickTech={onPickTech}
          onClearTech={onClearTech}
          onClearedSelectionByTyping={onClearedSelectionByTyping}
          canSearch={canSearch}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          searchBusy={searchBusy}
          searchError={searchError}
          searchItems={searchItems}
        />

        {blockedByBpAffiliation ? (
          <div className="rounded-2xl border bg-[var(--to-surface)] p-4">
            <p className="text-sm text-[var(--to-danger,#b91c1c)]">
              Report blocked. This technician is not affiliated with your BP
              company.
            </p>
          </div>
        ) : historyBusy ? (
          <div className="rounded-2xl border bg-[var(--to-surface)] p-4">
            <p className="text-sm text-[var(--to-ink-muted)]">
              Loading route history…
            </p>
          </div>
        ) : historyError ? (
          <div className="rounded-2xl border bg-[var(--to-surface)] p-4">
            <p className="text-sm text-[var(--to-danger,#b91c1c)]">
              {historyError}
            </p>
          </div>
        ) : !selectedTech ? (
          <div className="rounded-2xl border bg-[var(--to-surface)] p-4">
            <p className="text-sm text-[var(--to-ink-muted)]">
              Select a technician and week window to load route history.
            </p>
          </div>
        ) : history ? (
          <HistoryCheckInWeeklyCard
            rows={checkIn?.rows ?? []}
            loading={checkInBusy}
            error={checkInError}
            selectedTechLabel={selectedTechLabel}
            selectedAffiliation={selectedAffiliation}
            fromDate={fromDate}
            toDate={toDate}
          />
        ) : (
          <div className="rounded-2xl border bg-[var(--to-surface)] p-4">
            <p className="text-sm text-[var(--to-ink-muted)]">
              No history loaded yet.
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}