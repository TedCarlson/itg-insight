import { loadBlackoutCalendar } from "@/shared/server/calendar/loadBlackoutCalendar.server";
import {
  loadCalendarBlackoutRuleRows,
  loadHolidayBaselineRows,
} from "@/shared/server/calendar/repository";

import type {
  CalendarGovernanceRow,
  HolidayBaselineItem,
} from "@/shared/server/calendar/types";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function loadCalendarGovernancePage() {
  const today = new Date();

  const startDate = today.toISOString().slice(0, 10);

  const end = new Date(today);

  end.setUTCDate(end.getUTCDate() + 365);

  const endDate = end.toISOString().slice(0, 10);

  const [blackoutByDate, holidayRows, blackoutRuleRows] =
    await Promise.all([
      loadBlackoutCalendar({
        countryCode: "US",
        startDate,
        endDate,
      }),
      loadHolidayBaselineRows({
        countryCode: "US",
        startDate,
        endDate,
      }),
      loadCalendarBlackoutRuleRows({
        countryCode: "US",
        startDate,
        endDate,
      }),
    ]);

  const holidays: HolidayBaselineItem[] = holidayRows
    .map((row) => ({
      holidayId: clean(row.holiday_id),
      countryCode: clean(row.country_code),
      holidayDate: clean(row.holiday_date),
      holidayName: clean(row.holiday_name),
      source: clean(row.source),
      sourceKey: row.source_key ? clean(row.source_key) : null,
    }))
    .filter((row) => row.holidayId && row.holidayDate && row.holidayName);

  const blackoutRulesByHolidayId = new Map(
    blackoutRuleRows
      .filter((row) => row.source_holiday_id)
      .map((row) => [clean(row.source_holiday_id), row]),
  );

  const governanceRows: CalendarGovernanceRow[] = holidays.map(
    (holiday) => {
      const rule = blackoutRulesByHolidayId.get(holiday.holidayId);

      return {
        holidayId: holiday.holidayId,
        holidayName: holiday.holidayName,
        holidayDate: holiday.holidayDate,
        source: holiday.source,
        sourceKey: holiday.sourceKey,
        blackoutRuleId: rule ? clean(rule.blackout_rule_id) : null,
        expandedStartDate: rule
          ? clean(rule.start_date)
          : holiday.holidayDate,
        expandedEndDate: rule
          ? clean(rule.end_date)
          : holiday.holidayDate,
        blackoutType: rule
          ? clean(rule.blackout_type)
          : "holiday",
        managerControlledRequestEntry: rule
          ? rule.manager_controlled_request_entry === true
          : true,
        active: rule ? rule.active === true : true,
      };
    },
  );

  return {
    blackoutByDate,
    holidays,
    governanceRows,
  };
}
