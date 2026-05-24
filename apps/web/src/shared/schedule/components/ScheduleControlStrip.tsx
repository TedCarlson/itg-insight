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

export default function ScheduleControlStrip({
  filters,
}: Props) {

  const today =
    todayIso();

  return (
    <div className="sticky top-16 z-30 rounded-xl border bg-background/95 p-4 shadow-sm backdrop-blur">

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div className="flex flex-wrap items-center gap-3">

          <div className="rounded-lg border px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Start
            </div>

            <div className="text-sm font-medium">
              {filters.startDate}
            </div>
          </div>

          <div className="rounded-lg border px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              End
            </div>

            <div className="text-sm font-medium">
              {filters.endDate}
            </div>
          </div>

          <div className="rounded-lg border px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Org
            </div>

            <div className="text-sm font-medium">
              {filters.pcOrgId ?? "Scoped"}
            </div>
          </div>

        </div>

        <div className="flex flex-wrap items-center gap-3">

          <div className="flex rounded-lg border bg-muted/30 p-1">

            <Link
              href={hrefFor(filters, {
                anchorDate: navigationAnchor(filters, "previous"),
              })}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground"
            >
              Previous
            </Link>

            <Link
              href={hrefFor(filters, {
                anchorDate: today,
              })}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground"
            >
              Today
            </Link>

            <Link
              href={hrefFor(filters, {
                anchorDate: navigationAnchor(filters, "next"),
              })}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground"
            >
              Next
            </Link>

          </div>

          <div className="flex rounded-lg border bg-muted/30 p-1">

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
                  className={[
                    "rounded-md px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                  ].join(" ")}
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
