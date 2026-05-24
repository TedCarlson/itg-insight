// path: apps/web/src/shared/schedule/server/resolveScheduleDateRange.server.ts

import type {
  ScheduleViewMode,
} from "../types/scheduleSurfaceTypes";

type Args = {
  viewMode: ScheduleViewMode;
  startDate: string;
  endDate: string;
};

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function startOfWeekSunday(
  isoDate: string,
) {
  const date =
    new Date(`${isoDate}T00:00:00.000Z`);

  const day =
    date.getUTCDay();

  date.setUTCDate(
    date.getUTCDate() - day,
  );

  return date.toISOString().slice(0, 10);
}

function startOfMonth(
  isoDate: string,
) {
  return `${isoDate.slice(0, 7)}-01`;
}

function endOfMonth(
  isoDate: string,
) {
  const year =
    Number(isoDate.slice(0, 4));

  const month =
    Number(isoDate.slice(5, 7));

  const date =
    new Date(Date.UTC(year, month, 0));

  return date.toISOString().slice(0, 10);
}

export function resolveScheduleDateRange(
  args: Args,
) {
  const anchor =
    isIsoDate(args.startDate)
      ? args.startDate
      : new Date().toISOString().slice(0, 10);

  if (args.viewMode === "month") {
    return {
      startDate: startOfMonth(anchor),
      endDate: endOfMonth(anchor),
    };
  }

  if (args.viewMode === "week") {
    const startDate =
      startOfWeekSunday(anchor);

    return {
      startDate,
      endDate: addDays(startDate, 6),
    };
  }

  return {
    startDate: anchor,
    endDate: anchor,
  };
}
