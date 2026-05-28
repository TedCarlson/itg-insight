// path: apps/web/src/shared/server/route-lock/ota/otaReportService.server.ts

import {
  addDays,
  startOfWeekSunday,
  todayInNY,
} from "./otaDateUtils.server";
import {
  fetchOtaJobRows,
  fetchOtaRosterRows,
} from "./otaFirstJobRepository.server";
import { mapOtaFirstJobRows } from "./otaFirstJobMapper.server";
import { presentOtaReport } from "./otaReportPresenter.server";
import type { OtaReportParams } from "./otaReportTypes";

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthStart(anchor: string) {
  return `${anchor.slice(0, 8)}01`;
}

function monthEnd(anchor: string) {
  const year = Number(anchor.slice(0, 4));
  const monthIndex = Number(anchor.slice(5, 7)) - 1;
  return toDateOnly(new Date(year, monthIndex + 1, 0));
}

function shiftMonth(anchor: string, delta: number) {
  const year = Number(anchor.slice(0, 4));
  const monthIndex = Number(anchor.slice(5, 7)) - 1;
  return toDateOnly(new Date(year, monthIndex + delta, 1));
}

function monthLabel(anchor: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(`${monthStart(anchor)}T00:00:00`));
}

function resolveWindow(input: { params: OtaReportParams }) {
  const anchor = input.params.anchor ?? todayInNY();

  if (input.params.scope === "month") {
    return {
      anchor: monthStart(anchor),
      from: monthStart(anchor),
      to: monthEnd(anchor),
      label: monthLabel(anchor),
      previous_anchor: shiftMonth(anchor, -1),
      next_anchor: shiftMonth(anchor, 1),
    };
  }

  const from = startOfWeekSunday(anchor);
  const to = addDays(from, 6);

  return {
    anchor: from,
    from,
    to,
    label: `Week of ${from}`,
    previous_anchor: addDays(from, -7),
    next_anchor: addDays(from, 7),
  };
}

export async function getOtaReportAction(input: {
  admin: any;
  pcOrgId: string;
  params: OtaReportParams;
}) {
  const window = resolveWindow({ params: input.params });

  const jobs = await fetchOtaJobRows({
    admin: input.admin,
    pcOrgId: input.pcOrgId,
    from: window.from,
    to: window.to,
  });

  const techIds = Array.from(
    new Set(jobs.map((row) => String(row.tech_id ?? "").trim()).filter(Boolean))
  );

  const roster = await fetchOtaRosterRows({
    admin: input.admin,
    pcOrgId: input.pcOrgId,
    techIds,
  });

  const rows = mapOtaFirstJobRows({ jobs, roster });

  return presentOtaReport({
    scope: input.params.scope,
    anchor: window.anchor,
    from: window.from,
    to: window.to,
    label: window.label,
    previousAnchor: window.previous_anchor,
    nextAnchor: window.next_anchor,
    rows,
  });
}
