// apps/web/src/features/tech/schedule/page.tsx

import { getTechScheduleCalendar } from "@/features/tech/schedule/lib/getTechScheduleCalendar";
import type { TechScheduleDay } from "@/features/tech/schedule/lib/getTechScheduleCalendar";

function weekdayShort(idx: number) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx]!;
}

function buildMonthDays(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));

  const days: string[] = [];
  let cur = first;

  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10));
    cur = new Date(
      Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1),
    );
  }

  return days;
}

function buildCells(days: string[]) {
  const first = new Date(days[0] + "T00:00:00Z");
  const pad = first.getUTCDay();

  const cells: Array<{ date: string | null }> = [];

  for (let i = 0; i < pad; i += 1) cells.push({ date: null });
  for (const d of days) cells.push({ date: d });
  while (cells.length % 7 !== 0) cells.push({ date: null });

  return cells;
}

function dayNum(iso: string) {
  return Number(iso.slice(8, 10));
}

function tileState(day: TechScheduleDay | null) {
  const scheduled = Boolean(day?.scheduled);
  const badges = day?.dispatchBadges ?? [];
  const hasDispatch = Boolean(badges.length || day?.latestNote);
  const hasNoShow = badges.some((badge) =>
    String(badge).toLowerCase().includes("no show"),
  );
  const isBlackout = Boolean(day?.isBlackout);

  const label = String(day?.blackoutLabel ?? "").toLowerCase();

  const isApprovedPto =
    label.includes("pto") ||
    label.includes("vacation") ||
    label.includes("approved") ||
    label.includes("time off");

  if (isApprovedPto) {
    return {
      bg: "color-mix(in oklab, var(--to-success) 18%, var(--to-surface))",
      border: "color-mix(in oklab, var(--to-success) 70%, var(--to-border))",
      badge: "PTO",
      badgeClass:
        "bg-emerald-600 text-white border-emerald-700",
    };
  }

  if (isBlackout) {
    return {
      bg: "rgb(24 24 27)",
      border: "rgb(63 63 70)",
      badge: "BLACKOUT",
      badgeClass:
        "bg-zinc-950 text-white border-zinc-700",
    };
  }

  if (hasNoShow) {
    return {
      bg: "color-mix(in oklab, var(--to-danger) 12%, var(--to-surface))",
      border: "color-mix(in oklab, var(--to-danger) 70%, var(--to-border))",
      badge: "NO SHOW",
      badgeClass:
        "bg-red-600 text-white border-red-700",
    };
  }

  if (hasDispatch) {
    return {
      bg: "color-mix(in oklab, var(--to-warning) 8%, var(--to-surface))",
      border: "color-mix(in oklab, var(--to-warning) 45%, var(--to-border))",
      badge: "NOTE",
      badgeClass:
        "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
    };
  }

  if (day?.phase === "actual") {
    return {
      bg: "color-mix(in oklab, var(--to-success) 15%, var(--to-surface))",
      border: "color-mix(in oklab, var(--to-success) 60%, var(--to-border))",
      badge: "ACTUAL",
      badgeClass:
        "bg-emerald-600 text-white border-emerald-700",
    };
  }

  if (day?.phase === "built") {
    return {
      bg: "color-mix(in oklab, var(--to-success) 11%, var(--to-surface))",
      border: "color-mix(in oklab, var(--to-success) 50%, var(--to-border))",
      badge: "BUILT",
      badgeClass:
        "bg-emerald-500 text-white border-emerald-600",
    };
  }

  if (scheduled) {
    return {
      bg: "color-mix(in oklab, var(--to-accent) 10%, var(--to-surface))",
      border: "color-mix(in oklab, var(--to-accent) 60%, var(--to-border))",
      badge: "WORK",
      badgeClass:
        "bg-[var(--to-accent)] text-white border-[var(--to-accent)]",
    };
  }

  return {
    bg: "var(--to-surface)",
    border: "var(--to-border)",
    badge: "OFF",
    badgeClass:
      "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700",
  };
}

export default async function TechScheduleFeaturePage() {
  const payload = await getTechScheduleCalendar();

  const days = buildMonthDays(payload.year, payload.month);
  const cells = buildCells(days);

  return (
    <div className="space-y-4 pb-24">
      <section className="rounded-2xl border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Schedule
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold md:text-xl">
              {payload.monthLabel}
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Work schedule, blackout dates, and approved time off.
            </p>
          </div>

          <div className="hidden flex-wrap gap-2 md:flex">
            <LegendChip label="WORK" cls="bg-[var(--to-accent)] text-white border-[var(--to-accent)]" />
            <LegendChip label="OFF" cls="bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700" />
            <LegendChip label="PTO" cls="bg-emerald-600 text-white border-emerald-700" />
            <LegendChip label="BLACKOUT" cls="bg-zinc-950 text-white border-zinc-700" />
            <LegendChip label="NOTE" cls="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800" />
            <LegendChip label="NO SHOW" cls="bg-red-600 text-white border-red-700" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-3 md:p-4">
        <div className="mb-2 grid grid-cols-7 gap-1 md:gap-2">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div
              key={idx}
              className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:text-xs"
            >
              {weekdayShort(idx)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {cells.map((cell, idx) => {
            if (!cell.date) {
              return (
                <div
                  key={idx}
                  className="aspect-[0.95] rounded-2xl border border-transparent"
                />
              );
            }

            const day = payload.daysByDate.get(cell.date) ?? null;

            const state = tileState(day);

            const isToday = cell.date === payload.todayIso;

            const hasDispatch = Boolean(
              day?.dispatchBadges?.length || day?.latestNote,
            );

            return (
              <button
                key={cell.date}
                type="button"
                className={`relative flex aspect-[0.92] flex-col overflow-hidden rounded-2xl border p-1.5 text-left transition active:scale-[0.98] md:aspect-square md:p-2 ${
                  isToday ? "ring-2 ring-[var(--to-accent)]" : ""
                }`}
                style={{
                  backgroundColor: state.bg,
                  borderColor: state.border,
                }}
                title={[
                  cell.date,
                  day?.routeArea,
                  day?.latestNote,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`text-sm font-bold md:text-base ${
                      state.badge === "BLACKOUT"
                        ? "text-white"
                        : ""
                    }`}
                  >
                    {dayNum(cell.date)}
                  </span>

                  {isToday ? (
                    <span className="hidden rounded-full bg-[var(--to-accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white md:inline-flex">
                      Today
                    </span>
                  ) : null}
                </div>

                <div className="mt-auto space-y-1">
                  <div
                    className={`inline-flex max-w-full items-center truncate rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide md:text-[9px] ${state.badgeClass}`}
                  >
                    {state.badge}
                  </div>

                  {day?.routeArea ? (
                    <div
                      className={`truncate text-[9px] font-semibold md:text-[10px] ${
                        state.badge === "BLACKOUT"
                          ? "text-zinc-200"
                          : "text-foreground"
                      }`}
                    >
                      {day.routeArea}
                    </div>
                  ) : null}

                  {hasDispatch ? (
                    <div className="flex flex-wrap gap-1">
                      {(day?.dispatchBadges ?? []).slice(0, 2).map((badge) => (
                        <span
                          key={badge}
                          className="rounded-full bg-red-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 md:hidden">
          <LegendChip label="WORK" cls="bg-[var(--to-accent)] text-white border-[var(--to-accent)]" />
          <LegendChip label="OFF" cls="bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700" />
          <LegendChip label="PTO" cls="bg-emerald-600 text-white border-emerald-700" />
          <LegendChip label="BLACKOUT" cls="bg-zinc-950 text-white border-zinc-700" />
          <LegendChip label="NOTE" cls="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800" />
          <LegendChip label="NO SHOW" cls="bg-red-600 text-white border-red-700" />
        </div>
      </section>
    </div>
  );
}

function LegendChip({
  label,
  cls,
}: {
  label: string;
  cls: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}
