// apps/web/src/features/tech/schedule/page.tsx

import { getTechScheduleCalendar } from "@/features/tech/schedule/lib/getTechScheduleCalendar";

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
      Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1)
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

function phaseLabel(phase: string | null | undefined, scheduled: boolean) {
  if (phase === "actual") return "Actual";
  if (phase === "built") return "Built";
  if (scheduled) return "Planned";
  return "Off";
}

function tileTone(args: {
  scheduled: boolean;
  phase: string | null | undefined;
  hasDispatch: boolean;
}) {
  if (args.hasDispatch) {
    return {
      borderColor: "color-mix(in oklab, var(--to-danger) 58%, var(--to-border))",
      backgroundColor: "color-mix(in oklab, var(--to-danger) 10%, var(--to-surface))",
    };
  }

  if (args.phase === "actual") {
    return {
      borderColor: "color-mix(in oklab, var(--to-success) 62%, var(--to-border))",
      backgroundColor: "color-mix(in oklab, var(--to-success) 14%, var(--to-surface))",
    };
  }

  if (args.phase === "built") {
    return {
      borderColor: "color-mix(in oklab, var(--to-success) 50%, var(--to-border))",
      backgroundColor: "color-mix(in oklab, var(--to-success) 10%, var(--to-surface))",
    };
  }

  if (args.scheduled) {
    return {
      borderColor: "color-mix(in oklab, var(--to-success) 52%, var(--to-border))",
      backgroundColor: "color-mix(in oklab, var(--to-success) 9%, var(--to-surface))",
    };
  }

  return {
    borderColor: "color-mix(in oklab, var(--to-warning) 55%, var(--to-border))",
    backgroundColor: "color-mix(in oklab, var(--to-warning) 10%, var(--to-surface))",
  };
}

export default async function TechScheduleFeaturePage() {
  const payload = await getTechScheduleCalendar();
  const days = buildMonthDays(payload.year, payload.month);
  const cells = buildCells(days);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Schedule
        </div>

        <div className="mt-2 text-lg font-semibold">{payload.monthLabel}</div>

        {!payload.ok ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {payload.reason === "no_org" && "No org is selected."}
            {payload.reason === "no_person" && "No person is linked to this login."}
            {payload.reason === "no_active_assignment" &&
              "No active assignment was found for this tech."}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div
              key={idx}
              className="text-center text-[11px] font-medium text-muted-foreground"
            >
              {weekdayShort(idx)}
            </div>
          ))}

          {cells.map((cell, idx) => {
            if (!cell.date) {
              return (
                <div
                  key={idx}
                  className="aspect-square rounded-xl border border-transparent"
                />
              );
            }

            const day = payload.daysByDate.get(cell.date) ?? null;
            const scheduled = Boolean(day?.scheduled);
            const isToday = cell.date === payload.todayIso;

            const units =
              day?.actualUnits ??
              day?.builtUnits ??
              day?.plannedUnits ??
              null;

            const hasDispatch =
              Boolean(day?.dispatchBadges.length || day?.latestNote);

            const state =
              phaseLabel(day?.phase, scheduled);

            const style =
              tileTone({
                scheduled,
                phase: day?.phase,
                hasDispatch,
              });

            return (
              <div
                key={cell.date}
                className={`aspect-square cursor-pointer rounded-xl border p-2 active:scale-[0.98] ${
                  isToday ? "ring-2 ring-[var(--to-accent)]" : ""
                }`}
                style={style}
                title={[
                  cell.date,
                  state,
                  day?.routeArea,
                  units == null ? null : `${units} units`,
                  day?.dispatchBadges.join(", "),
                  day?.latestNote,
                ].filter(Boolean).join(" • ")}
              >
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-start justify-end">
                    <span className="text-sm font-semibold">{dayNum(cell.date)}</span>
                  </div>

                  {day?.routeArea ? (
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-semibold">
                        {day.routeArea}
                      </div>

                      {hasDispatch ? (
                        <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
