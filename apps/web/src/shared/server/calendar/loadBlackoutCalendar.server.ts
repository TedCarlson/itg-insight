import {
  expandBlackoutDateRanges,
  expandHolidayBaselineDates,
} from "./expandDateRanges";
import {
  loadCalendarBlackoutRuleRows,
  loadHolidayBaselineRows,
} from "./repository";

import type {
  BlackoutCalendarDay,
  LoadBlackoutCalendarArgs,
} from "./types";

export async function loadBlackoutCalendar(
  args: LoadBlackoutCalendarArgs,
): Promise<Map<string, BlackoutCalendarDay>> {
  const [holidayRows, blackoutRuleRows] = await Promise.all([
    loadHolidayBaselineRows(args),
    loadCalendarBlackoutRuleRows(args),
  ]);

  const seededHolidayLookup =
    expandHolidayBaselineDates(holidayRows);

  return expandBlackoutDateRanges(
    blackoutRuleRows,
    seededHolidayLookup,
  );
}
