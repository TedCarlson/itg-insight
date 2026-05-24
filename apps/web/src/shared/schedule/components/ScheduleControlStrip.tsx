// path: apps/web/src/shared/schedule/components/ScheduleControlStrip.tsx

"use client";

import Link from "next/link";

import type {
  ScheduleSurfaceFilters,
  ScheduleViewMode,
} from "../types/scheduleSurfaceTypes";

type Props = {
  filters: ScheduleSurfaceFilters;
};

const VIEW_MODES: Array<{
  key: ScheduleViewMode;
  label: string;
}> = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(
  isoDate: string,
  days: number,
) {
  const date =
    new Date(`${isoDate}T00:00:00.000Z`);

  date.setUTCDate(
    date.getUTCDate() + days,
  );

  return date.toISOString().slice(0, 10);
}

function addMonths(
  isoDate: string,
  months: number,
) {
  const date =
    new Date(`${isoDate}T00:00:00.000Z`);

  date.setUTCMonth(
    date.getUTCMonth() + months,
  );

  return date.toISOString().slice(0, 10);
}

function navigationAnchor(
  filters: ScheduleSurfaceFilters,
  direction: "previous" | "next",
) {
  if (filters.viewMode === "month") {
    return addMonths(
      filters.startDate,
      direction === "next" ? 1 : -1,
    );
  }

  if (filters.viewMode === "week") {
    return addDays(
      filters.startDate,
      direction === "next" ? 7 : -7,
    );
  }

  return addDays(
    filters.startDate,
    direction === "next" ? 1 : -1,
  );
}

function hrefFor(
  filters: ScheduleSurfaceFilters,
  args: {
    viewMode?: ScheduleViewMode;
    anchorDate?: string;
  },
) {
  const params =
    new URLSearchParams();

  const viewMode =
    args.viewMode ?? filters.viewMode;

  const anchorDate =
    args.anchorDate ?? filters.startDate;

  params.set("view_mode", viewMode);
  params.set("start_date", anchorDate);

  if (filters.pcOrgId) {
    params.set("pc_org_id", filters.pcOrgId);
  }

  return `/schedule?${params.toString()}`;
}

function cx(
  ...parts: Array<string | false | null | undefined>
) {
  return parts.filter(Boolean).join(" ");
}

export default function ScheduleControlStrip({
  filters,
}: Props) {
  const today =
    todayIso();

  return (
    <div className="sticky top-16 z-30 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">

      <div className="flex flex-wrap items-center justify-between gap-2">

        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">

          <div className="inline-flex items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">
              Range
            </span>

            <span className="font-medium tabular-nums">
              {filters.startDate}
            </span>

            <span className="text-muted-foreground">
              →
            </span>

            <span className="font-medium tabular-nums">
              {filters.endDate}
            </span>
          </div>

        </div>

        <div className="flex flex-wrap items-center gap-2">

          <div className="inline-flex overflow-hidden rounded-md border bg-muted/20 text-xs">

            <Link
              href={hrefFor(filters, {
                anchorDate: navigationAnchor(filters, "previous"),
              })}
              className="px-2.5 py-1.5 font-medium text-muted-foreground hover:bg-background hover:text-foreground"
            >
              Prev
            </Link>

            <Link
              href={hrefFor(filters, {
                anchorDate: today,
              })}
              className="border-l px-2.5 py-1.5 font-medium text-muted-foreground hover:bg-background hover:text-foreground"
            >
              Today
            </Link>

            <Link
              href={hrefFor(filters, {
                anchorDate: navigationAnchor(filters, "next"),
              })}
              className="border-l px-2.5 py-1.5 font-medium text-muted-foreground hover:bg-background hover:text-foreground"
            >
              Next
            </Link>

          </div>

          <div className="inline-flex overflow-hidden rounded-md border bg-muted/20 text-xs">

            {VIEW_MODES.map((mode) => {
              const active =
                filters.viewMode === mode.key;

              return (
                <Link
                  key={mode.key}
                  href={hrefFor(filters, {
                    viewMode: mode.key,
                    anchorDate: today,
                  })}
                  className={cx(
                    "border-l px-2.5 py-1.5 font-medium first:border-l-0",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                >
                  {mode.label}
                </Link>
              );
            })}

          </div>

        </div>

      </div>

    </div>
  );
}
