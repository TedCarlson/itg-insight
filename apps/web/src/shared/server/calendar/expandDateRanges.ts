import type {
  BlackoutCalendarDay,
  CalendarBlackoutRuleRow,
  CalendarHolidayBaselineRow,
} from "./types";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);

  next.setUTCDate(next.getUTCDate() + days);

  return next;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function upsertDay(
  lookup: Map<string, BlackoutCalendarDay>,
  dayKey: string,
) {
  const existing = lookup.get(dayKey) ?? {
    date: dayKey,
    rules: [],
  };

  lookup.set(dayKey, existing);

  return existing;
}

export function expandHolidayBaselineDates(
  rows: CalendarHolidayBaselineRow[],
): Map<string, BlackoutCalendarDay> {
  const lookup = new Map<string, BlackoutCalendarDay>();

  for (const row of rows) {
    const holidayId = clean(row.holiday_id);
    const holidayDate = clean(row.holiday_date);
    const holidayName = clean(row.holiday_name);

    if (!holidayId) continue;
    if (!isIsoDate(holidayDate)) continue;
    if (!holidayName) continue;

    const day = upsertDay(lookup, holidayDate);

    day.rules.push({
      blackoutRuleId: `holiday:${holidayId}`,
      label: holidayName,
      blackoutType: "holiday",
      managerControlledRequestEntry: true,
      source: "holiday_baseline",
      sourceHolidayId: holidayId,
    });
  }

  return lookup;
}

export function expandBlackoutDateRanges(
  rows: CalendarBlackoutRuleRow[],
  seedLookup = new Map<string, BlackoutCalendarDay>(),
): Map<string, BlackoutCalendarDay> {
  const lookup = seedLookup;

  for (const row of rows) {
    const blackoutRuleId = clean(row.blackout_rule_id);
    const startDate = clean(row.start_date);
    const endDate = clean(row.end_date);

    if (!blackoutRuleId) continue;
    if (!isIsoDate(startDate)) continue;
    if (!isIsoDate(endDate)) continue;

    let cursor = toUtcDate(startDate);

    const end = toUtcDate(endDate);

    while (cursor <= end) {
      const dayKey = formatIsoDate(cursor);

      const day = upsertDay(lookup, dayKey);

      day.rules.push({
        blackoutRuleId,
        label: clean(row.label),
        blackoutType: clean(row.blackout_type),
        managerControlledRequestEntry:
          row.manager_controlled_request_entry === true,
        source: "blackout_rule",
        sourceHolidayId: row.source_holiday_id
          ? clean(row.source_holiday_id)
          : null,
      });

      cursor = addDays(cursor, 1);
    }
  }

  return lookup;
}
