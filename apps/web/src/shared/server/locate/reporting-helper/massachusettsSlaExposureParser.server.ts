import type {
  MassachusettsSlaExposureGeneratedReport,
  MassachusettsSlaExposureRow,
  MassachusettsSlaRisk,
} from "./reportingHelperTypes";

const EXPECTED_HEADERS = [
  "Ticket ID", "Facility", "Received Time", "Code", "Due Time", "Type",
  "Work Type", "Excavator Name", "State", "Place", "Status", "Last Response",
  "Last Response Date", "Total Units of Work", "Assigned To", "Division", "Region",
] as const;

function parseLocalWallClock(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[4]);
  const meridiem = match[7].toUpperCase();
  if (hour === 12) hour = 0;
  if (meridiem === "PM") hour += 12;
  return Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]), hour, Number(match[5]), Number(match[6]));
}

function wallClockIso(value: string | null) {
  const epoch = value ? parseLocalWallClock(value) : null;
  return epoch == null ? null : new Date(epoch).toISOString().replace("Z", "");
}

function easternInstantIso(wallEpoch: number) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  let instant = wallEpoch + 5 * 3_600_000;
  for (let i = 0; i < 2; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const displayedWall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    instant += wallEpoch - displayedWall;
  }
  return new Date(instant).toISOString();
}

function riskFor(dueEpoch: number | null, asOfEpoch: number): MassachusettsSlaRisk {
  if (dueEpoch == null) return "UNKNOWN";
  const hours = (dueEpoch - asOfEpoch) / 3_600_000;
  if (hours < 0) return "OVERDUE";
  if (hours <= 4) return "DUE_WITHIN_4_HOURS";
  if (hours <= 24) return "DUE_WITHIN_24_HOURS";
  return "FUTURE";
}

function hoursUntil(dueEpoch: number | null, asOfEpoch: number) {
  if (dueEpoch == null) return null;
  return Math.round(((dueEpoch - asOfEpoch) / 3_600_000) * 10) / 10;
}

function countBy(rows: MassachusettsSlaExposureRow[], key: (row: MassachusettsSlaExposureRow) => string | null) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = key(row)?.trim() || "Unspecified";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function generateMassachusettsSlaExposureReport(rawText: string): MassachusettsSlaExposureGeneratedReport {
  const lines = rawText.replace(/\r\n?/g, "\n").split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error("Massachusetts SLA Exposure requires a tab-delimited header and at least one ticket row.");

  const headers = lines[0].split("\t").map((value) => value.trim());
  const missing = EXPECTED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Ticket Summary is missing required columns: ${missing.join(", ")}`);

  const index = new Map(headers.map((header, i) => [header, i]));
  const valueAt = (cells: string[], header: typeof EXPECTED_HEADERS[number]) => (cells[index.get(header) ?? -1] ?? "").trim();

  const warnings: string[] = [];
  const skippedLines: string[] = [];
  const parsed = lines.slice(1).flatMap((line, lineIndex) => {
    const cells = line.split("\t");
    const ticketId = valueAt(cells, "Ticket ID");
    const receivedTime = valueAt(cells, "Received Time");
    const dueTime = valueAt(cells, "Due Time");
    if (!ticketId || !receivedTime || !dueTime) {
      skippedLines.push(`Line ${lineIndex + 2}: ${line}`);
      return [];
    }
    return [{
      ticketId,
      facility: valueAt(cells, "Facility") || null,
      receivedTime,
      receivedEpoch: parseLocalWallClock(receivedTime),
      code: valueAt(cells, "Code") || null,
      dueTime,
      dueEpoch: parseLocalWallClock(dueTime),
      ticketType: valueAt(cells, "Type") || null,
      workType: valueAt(cells, "Work Type") || null,
      excavatorName: valueAt(cells, "Excavator Name") || null,
      state: valueAt(cells, "State") || null,
      place: valueAt(cells, "Place") || null,
      status: valueAt(cells, "Status") || null,
      lastResponse: valueAt(cells, "Last Response") || null,
      lastResponseDate: valueAt(cells, "Last Response Date") || null,
      lastResponseEpoch: parseLocalWallClock(valueAt(cells, "Last Response Date")),
      totalUnitsOfWork: Number(valueAt(cells, "Total Units of Work")) || null,
      assignedTo: valueAt(cells, "Assigned To") || null,
      division: valueAt(cells, "Division") || null,
      region: valueAt(cells, "Region") || null,
    }];
  });

  if (!parsed.length) throw new Error("No valid Ticket Summary rows were found.");
  const nonMa = parsed.filter((row) => row.state && row.state.toUpperCase() !== "MA");
  if (nonMa.length) warnings.push(`${nonMa.length} non-Massachusetts row(s) were retained for source fidelity.`);

  const asOfEpoch = Math.max(...parsed.flatMap((row) => [row.receivedEpoch, row.lastResponseEpoch].filter((value): value is number => value != null)));
  const occurrenceCount = new Map<string, number>();
  parsed.forEach((row) => occurrenceCount.set(row.ticketId, (occurrenceCount.get(row.ticketId) ?? 0) + 1));

  const rows: MassachusettsSlaExposureRow[] = parsed.map((row) => ({
    ticketId: row.ticketId,
    facility: row.facility,
    receivedTime: row.receivedTime,
    receivedAt: wallClockIso(row.receivedTime),
    code: row.code,
    dueTime: row.dueTime,
    dueAt: wallClockIso(row.dueTime),
    ticketType: row.ticketType,
    workType: row.workType,
    excavatorName: row.excavatorName,
    state: row.state,
    place: row.place,
    status: row.status,
    lastResponse: row.lastResponse,
    lastResponseDate: row.lastResponseDate,
    lastResponseAt: wallClockIso(row.lastResponseDate),
    totalUnitsOfWork: row.totalUnitsOfWork,
    assignedTo: row.assignedTo,
    division: row.division,
    region: row.region,
    risk: riskFor(row.dueEpoch, asOfEpoch),
    hoursUntilDue: hoursUntil(row.dueEpoch, asOfEpoch),
    hasResponseEvidence: Boolean(row.lastResponse || row.lastResponseDate),
    duplicateOccurrenceCount: occurrenceCount.get(row.ticketId) ?? 1,
  }));

  const overdue = rows.filter((row) => row.risk === "OVERDUE");
  const imminent = rows.filter((row) => row.risk === "DUE_WITHIN_4_HOURS");
  const dueToday = rows.filter((row) => row.risk === "DUE_WITHIN_24_HOURS");
  const noResponse = rows.filter((row) => !row.hasResponseEvidence);
  const duplicateTicketIds = [...occurrenceCount.entries()].filter(([, count]) => count > 1).map(([ticketId]) => ticketId).sort();

  return {
    reportName: "MASSACHUSETTS_SLA_EXPOSURE",
    title: "Massachusetts SLA Exposure",
    sourceAsOfLocal: new Date(asOfEpoch).toISOString().replace("T", " ").replace(".000Z", ""),
    sourceAsOfAt: easternInstantIso(asOfEpoch),
    reportDate: new Date(asOfEpoch).toISOString().slice(0, 10),
    rows,
    summary: {
      totalRows: rows.length,
      uniqueTickets: occurrenceCount.size,
      overdue: overdue.length,
      dueWithin4Hours: imminent.length,
      dueWithin24Hours: dueToday.length,
      future: rows.filter((row) => row.risk === "FUTURE").length,
      withoutResponseEvidence: noResponse.length,
      duplicateTicketIds: duplicateTicketIds.length,
      emergencyTickets: rows.filter((row) => row.ticketType?.toUpperCase() === "EMERGENCY").length,
      renewTickets: rows.filter((row) => row.ticketType?.toUpperCase() === "RENEW").length,
    },
    exposure: {
      byTechnician: countBy(overdue, (row) => row.assignedTo),
      byPlace: countBy(overdue, (row) => row.place),
      byDivision: countBy(overdue, (row) => row.division),
      byRegion: countBy(overdue, (row) => row.region),
      byTicketType: countBy(overdue, (row) => row.ticketType),
    },
    duplicateTicketIds,
    warnings,
    skippedLines,
  };
}
