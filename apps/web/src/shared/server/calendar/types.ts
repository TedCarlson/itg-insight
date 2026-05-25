export type BlackoutCalendarRule = {
  blackoutRuleId: string;
  label: string;
  blackoutType: string;
  managerControlledRequestEntry: boolean;
  source: "holiday_baseline" | "blackout_rule";
  sourceHolidayId: string | null;
};

export type BlackoutCalendarDay = {
  date: string;
  rules: BlackoutCalendarRule[];
};

export type LoadBlackoutCalendarArgs = {
  countryCode: string;
  startDate: string;
  endDate: string;
};

export type CalendarBlackoutRuleRow = {
  blackout_rule_id: string | null;
  country_code: string | null;
  label: string | null;
  start_date: string | null;
  end_date: string | null;
  source_holiday_id: string | null;
  blackout_type: string | null;
  manager_controlled_request_entry: boolean | null;
  active: boolean | null;
};

export type CalendarHolidayBaselineRow = {
  holiday_id: string | null;
  country_code: string | null;
  holiday_date: string | null;
  holiday_name: string | null;
  source: string | null;
  source_key: string | null;
  created_at: string | null;
};

export type HolidayBaselineItem = {
  holidayId: string;
  countryCode: string;
  holidayDate: string;
  holidayName: string;
  source: string;
  sourceKey: string | null;
};

export type CalendarGovernanceRow = {
  holidayId: string;
  holidayName: string;
  holidayDate: string;
  source: string;
  sourceKey: string | null;
  blackoutRuleId: string | null;
  expandedStartDate: string;
  expandedEndDate: string;
  blackoutType: string;
  managerControlledRequestEntry: boolean;
  active: boolean;
};
