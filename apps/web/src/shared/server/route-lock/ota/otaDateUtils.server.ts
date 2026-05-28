// path: apps/web/src/shared/server/route-lock/ota/otaDateUtils.server.ts

export function todayInNY() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateOnly: string, days: number) {
  const d = new Date(`${dateOnly}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

export function startOfWeekSunday(dateOnly: string) {
  const d = new Date(`${dateOnly}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return toDateOnly(d);
}

export function lastCompletedSaturday(anchorDate = todayInNY()) {
  const d = new Date(`${anchorDate}T00:00:00`);
  const day = d.getDay();
  const daysSinceSaturday = day === 6 ? 7 : day + 1;
  d.setDate(d.getDate() - daysSinceSaturday);
  return toDateOnly(d);
}

export function weekdayLabel(dateOnly: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
    new Date(`${dateOnly}T00:00:00`)
  );
}

export function buildWeeks(from: string, to: string) {
  const weeks = [];
  let cursor = startOfWeekSunday(from);

  while (cursor <= to) {
    const weekStart = cursor;
    const weekEndRaw = addDays(weekStart, 6);
    const weekEnd = weekEndRaw > to ? to : weekEndRaw;

    weeks.push({
      week_start: weekStart,
      week_end: weekEnd,
      days: Array.from({ length: 7 }).map((_, index) => {
        const date = addDays(weekStart, index);
        return {
          date,
          label: weekdayLabel(date),
          in_range: date >= from && date <= to,
        };
      }),
    });

    cursor = addDays(cursor, 7);
  }

  return weeks;
}
