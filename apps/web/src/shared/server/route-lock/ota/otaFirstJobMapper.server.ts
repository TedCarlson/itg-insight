// path: apps/web/src/shared/server/route-lock/ota/otaFirstJobMapper.server.ts

import { weekdayLabel } from "./otaDateUtils.server";
import type { OtaFirstJobRow, OtaRawJobRow, OtaRosterRow, OtaStatus } from "./otaReportTypes";

const GRACE_MINUTES = 15;
const MAX_TTFJ_TIMEFRAME_MINUTES = 120;

function timeToMinutes(time: string | null) {
  if (!time) return null;

  const m = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;

  const hh = Number(m[1]);
  const mm = Number(m[2]);

  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  return hh * 60 + mm;
}

function timeframeMinutes(start: string | null, end: string | null) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes == null || endMinutes == null) return null;

  const raw = endMinutes - startMinutes;
  return raw >= 0 ? raw : raw + 24 * 60;
}

function formatDuration(minutes: number | null) {
  if (minutes == null || !Number.isFinite(minutes)) return "—";

  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;

  if (hh === 0) return `${sign}${mm}m`;

  return `${sign}${hh}:${String(mm).padStart(2, "0")}`;
}

function formatTimeFrame(start: string | null, end: string | null) {
  if (!start || !end) return null;

  const hour = (value: string) => {
    const n = Number(value.slice(0, 2));
    if (!Number.isFinite(n)) return null;
    if (n === 0) return 12;
    if (n > 12) return n - 12;
    return n;
  };

  const s = hour(start);
  const e = hour(end);

  return s == null || e == null ? null : `${s}-${e}`;
}

function firstJobsByTechDate(rows: OtaRawJobRow[]) {
  const map = new Map<string, OtaRawJobRow>();

  for (const row of rows) {
    const date = String(row.cp_date ?? "").trim();
    const techId = String(row.tech_id ?? "").trim();

    if (!date || !techId) continue;

    const key = `${date}::${techId}`;
    if (!map.has(key)) map.set(key, row);
  }

  return Array.from(map.entries());
}

function resolveStatus(input: {
  ttfjMinutes: number | null;
  lateMinutes: number | null;
  isEligible: boolean;
}): OtaStatus {
  if (!input.isEligible) return "INELIGIBLE";
  if (input.ttfjMinutes == null) return "UNKNOWN";
  if (Number(input.lateMinutes ?? 0) > 0) return "LATE";
  if (input.ttfjMinutes > 0) return "GRACE";
  return "ON_TIME";
}

export function mapOtaFirstJobRows(input: {
  jobs: OtaRawJobRow[];
  roster: OtaRosterRow[];
}): OtaFirstJobRow[] {
  const rosterByTech = new Map<string, { full_name: string; affiliation: string | null }>();

  for (const row of input.roster) {
    const techId = String(row.tech_id ?? "").trim();
    if (!techId || rosterByTech.has(techId)) continue;

    rosterByTech.set(techId, {
      full_name: String(row.full_name ?? techId),
      affiliation: row.co_name ? String(row.co_name) : null,
    });
  }

  return firstJobsByTechDate(input.jobs).map(([key, row]) => {
    const [shiftDate, techId] = key.split("::");
    const roster = rosterByTech.get(techId);

    const slotStart = row.time_slot_start_time ? String(row.time_slot_start_time) : null;
    const slotEnd = row.time_slot_end_time ? String(row.time_slot_end_time) : null;
    const actualStart = row.start_time ? String(row.start_time) : null;
    const frameMinutes = timeframeMinutes(slotStart, slotEnd);

    const hasRequiredTimes = Boolean(slotStart && slotEnd && actualStart);
    const isPoleLikeFrame =
      frameMinutes != null && frameMinutes > MAX_TTFJ_TIMEFRAME_MINUTES;
    const isEligible = hasRequiredTimes && !isPoleLikeFrame;

    const slotMinutes = timeToMinutes(slotStart);
    const actualMinutes = timeToMinutes(actualStart);

    const ttfjMinutes =
      !isEligible || slotMinutes == null || actualMinutes == null
        ? null
        : actualMinutes - slotMinutes;

    const lateMinutes = ttfjMinutes == null ? null : Math.max(0, ttfjMinutes - GRACE_MINUTES);

    const exclusionReason = !hasRequiredTimes
      ? "Missing timeframe/start"
      : isPoleLikeFrame
        ? "POLE/SRO"
        : null;

    return {
      shift_date: shiftDate,
      weekday_label: weekdayLabel(shiftDate),
      tech_id: techId,
      full_name: roster?.full_name ?? String(row.source_tech_last_name ?? techId),
      affiliation: roster?.affiliation ?? null,
      job_num: row.job_num ? String(row.job_num) : null,
      work_order_number: row.work_order_number ? String(row.work_order_number) : null,
      job_type: row.job_type ? String(row.job_type) : null,
      time_slot_start_time: slotStart,
      time_slot_end_time: slotEnd,
      time_frame: formatTimeFrame(slotStart, slotEnd),
      time_frame_minutes: frameMinutes,
      actual_start_time: actualStart,
      ttfj_minutes: ttfjMinutes,
      ttfj_display: formatDuration(ttfjMinutes),
      late_minutes: lateMinutes,
      late_display: formatDuration(lateMinutes),
      status: resolveStatus({ ttfjMinutes, lateMinutes, isEligible }),
      is_ttfj_eligible: isEligible,
      exclusion_reason: exclusionReason,
      route_area: null,
      route_area_source: null,
    };
  });
}
