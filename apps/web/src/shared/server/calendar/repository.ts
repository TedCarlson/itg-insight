import { supabaseAdmin } from "@/shared/data/supabase/admin";

import type {
  CalendarBlackoutRuleRow,
  CalendarHolidayBaselineRow,
  LoadBlackoutCalendarArgs,
} from "./types";

const BLACKOUT_RULE_SELECT_COLUMNS = [
  "blackout_rule_id",
  "country_code",
  "label",
  "start_date",
  "end_date",
  "source_holiday_id",
  "blackout_type",
  "manager_controlled_request_entry",
  "active",
].join(",");

const HOLIDAY_BASELINE_SELECT_COLUMNS = [
  "holiday_id",
  "country_code",
  "holiday_date",
  "holiday_name",
  "source",
  "source_key",
  "created_at",
].join(",");

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateArgs(args: LoadBlackoutCalendarArgs, caller: string) {
  const countryCode = clean(args.countryCode).toUpperCase();
  const startDate = clean(args.startDate);
  const endDate = clean(args.endDate);

  if (!countryCode) {
    throw new Error(`${caller} requires countryCode`);
  }

  if (!isIsoDate(startDate)) {
    throw new Error(`${caller} requires ISO startDate`);
  }

  if (!isIsoDate(endDate)) {
    throw new Error(`${caller} requires ISO endDate`);
  }

  return {
    countryCode,
    startDate,
    endDate,
  };
}

export async function loadCalendarBlackoutRuleRows(
  args: LoadBlackoutCalendarArgs,
): Promise<CalendarBlackoutRuleRow[]> {
  const { countryCode, startDate, endDate } = validateArgs(
    args,
    "loadCalendarBlackoutRuleRows",
  );

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("calendar_blackout_rule")
    .select(BLACKOUT_RULE_SELECT_COLUMNS)
    .eq("active", true)
    .eq("country_code", countryCode)
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .order("start_date", { ascending: true });

  if (error) {
    throw new Error(
      `Calendar blackout rule lookup failed: ${error.message}`,
    );
  }

  return (data ?? []) as unknown as CalendarBlackoutRuleRow[];
}

export async function loadHolidayBaselineRows(
  args: LoadBlackoutCalendarArgs,
): Promise<CalendarHolidayBaselineRow[]> {
  const { countryCode, startDate, endDate } = validateArgs(
    args,
    "loadHolidayBaselineRows",
  );

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("calendar_holiday_baseline")
    .select(HOLIDAY_BASELINE_SELECT_COLUMNS)
    .eq("country_code", countryCode)
    .gte("holiday_date", startDate)
    .lte("holiday_date", endDate)
    .order("holiday_date", { ascending: true });

  if (error) {
    throw new Error(
      `Holiday baseline lookup failed: ${error.message}`,
    );
  }

  return (data ?? []) as unknown as CalendarHolidayBaselineRow[];
}
