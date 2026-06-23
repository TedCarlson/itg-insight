import type { CotpGeneratedReport, CotpParsedRow, CotpStatus } from "./reportingHelperTypes";

function normalizeInput(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[–—]/g, "-")
    .replace(/[…]+/g, " ")
    .replace(/\.{2,}/g, " ")
    .split("\n")
    .map((line) => line.replace(/^\s*[*•-]\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function inferDate(mmdd: string | null) {
  if (!mmdd) return { inferredYear: null, iso: null };
  const [mRaw, dRaw] = mmdd.split("/");
  const month = Number(mRaw);
  const day = Number(dRaw);
  const year = new Date().getFullYear();

  if (!Number.isFinite(month) || !Number.isFinite(day)) {
    return { inferredYear: null, iso: null };
  }

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { inferredYear: year, iso };
}

function changeDisplay(changePoints: number) {
  const unit = Math.abs(changePoints) === 1 ? "pt" : "pts";
  if (changePoints > 0) return `▲ +${changePoints} ${unit}`;
  if (changePoints < 0) return `▼ ${changePoints} ${unit}`;
  return `— 0 pts`;
}

function classify(row: Omit<CotpParsedRow, "status">): CotpStatus {
  const finalValue = row.weekEndingValue;
  const trend = row.currentWeekTrend;
  const signalValue = trend ?? finalValue;
  const recoveryLift = trend == null ? 0 : trend - finalValue;

  if (finalValue === 100 && signalValue === 100) return "Excellent";

  if (signalValue < 90) return "Needs attention";

  if (signalValue >= 96) {
    if (trend != null && finalValue < 90 && recoveryLift >= 10) return "Recovery trending";
    if (row.changePoints >= 10 && finalValue >= 96) return "Strong improvement";
    if (finalValue < 96) return trend == null ? "Strong" : "Improving trend";
    return "Strong";
  }

  if (signalValue >= 90 && signalValue <= 95) return "Watch closely";

  return "Stable";
}

function parseHeader(lines: string[]) {
  const header = lines.find((line) => /COTP/i.test(line) && /all-in week/i.test(line) && /@\s*\d+%/.test(line));
  if (!header) return null;

  const match = header.match(/COTP\s*-\s*(.*?),\s*all-in week\s+([\d/]+)\s*@\s*(\d+)%/i);
  if (!match) return null;

  const weekEnding = match[2] ?? null;
  const date = inferDate(weekEnding);

  return {
    reportName: "COTP" as const,
    contextNote: match[1]?.trim() || null,
    weekEnding,
    weekEndingDate: date.iso,
    inferredYear: date.inferredYear,
    overallPerformance: Number(match[3]),
  };
}

function parseRows(lines: string[]) {
  const rows: CotpParsedRow[] = [];
  const skippedLines: string[] = [];
  const warnings: string[] = [];

  const stateLineRegex =
    /^([A-Z]{2})\s*-\s*(\d+)%\s+(up|down|flat)\s+from\s+(\d+)%\s+prior week(?:\s+\(([^)]+)\))?(?:.*?(?:current\s+week\s+)?(?:trend|trending)\s*(?:@|at|:)?\s*(\d+)%?)?/i;

  for (const line of lines) {
    if (!/^[A-Z]{2}\s*-/.test(line)) continue;

    const match = line.match(stateLineRegex);
    if (!match) {
      skippedLines.push(line);
      continue;
    }

    const state = match[1].toUpperCase();
    const weekEndingValue = Number(match[2]);
    const direction = match[3].toLowerCase();
    const priorWeekValue = Number(match[4]);
    const priorWeekRange = match[5]?.trim() ?? null;
    const currentWeekTrend = match[6] == null ? null : Number(match[6]);
    const changePoints = weekEndingValue - priorWeekValue;

    if (
      (direction === "up" && changePoints < 0) ||
      (direction === "down" && changePoints > 0) ||
      (direction === "flat" && changePoints !== 0)
    ) {
      warnings.push(`Direction text did not match calculated change for ${state}. Calculated value was used.`);
    }

    const base = {
      state,
      weekEndingValue,
      direction,
      priorWeekValue,
      priorWeekRange,
      currentWeekTrend,
      changePoints,
      changeDisplay: changeDisplay(changePoints),
    };

    rows.push({
      ...base,
      status: classify(base),
    });
  }

  return { rows, skippedLines, warnings };
}

function listStates(rows: CotpParsedRow[]) {
  return rows.map((row) => row.state).join(", ");
}

function generateKeyTakeaways(rows: CotpParsedRow[]) {
  return {
    "Strong / Stable Performance": rows
      .filter((r) => ["Excellent", "Strong", "Strong improvement"].includes(r.status))
      .map((r) => r.state),
    "Improving Trend": rows
      .filter((r) => ["Recovery trending", "Improving trend"].includes(r.status))
      .map((r) => r.state),
    "Watch Closely": rows
      .filter((r) => r.status === "Watch closely")
      .map((r) => r.state),
    "Needs Attention": rows
      .filter((r) => r.status === "Needs attention")
      .map((r) => r.state),
  };
}

function generateExecutiveSummary(report: {
  weekEnding: string | null;
  overallPerformance: number | null;
  contextNote: string | null;
  rows: CotpParsedRow[];
}) {
  const top = [...report.rows].sort((a, b) => b.weekEndingValue - a.weekEndingValue).slice(0, 5);
  const improved = [...report.rows].sort((a, b) => b.changePoints - a.changePoints).slice(0, 3);
  const attention = report.rows.filter((row) =>
    ["Needs attention", "Watch closely", "Recovery trending"].includes(row.status)
  );
  const recovery = report.rows
    .filter((row) => row.status === "Recovery trending")
    .map((row) => row.state);

  const parts = [
    `COTP performance${report.weekEnding ? ` for the week ending ${report.weekEnding}` : ""} finished${report.overallPerformance != null ? ` at ${report.overallPerformance}% all-in` : ""}.`,
  ];

  if (report.contextNote) {
    parts.push(`${report.contextNote.charAt(0).toUpperCase()}${report.contextNote.slice(1)}.`);
  }

  if (top.length) {
    parts.push(`Strongest performance is currently concentrated in ${listStates(top)}.`);
  }

  if (improved.length) {
    parts.push(`Largest improvement came from ${improved.map((r) => `${r.state} (${r.changeDisplay})`).join(", ")}.`);
  }

  if (recovery.length) {
    parts.push(`Recovery states include ${recovery.join(", ")}, where available trend data shows material improvement from the week-ending result.`);
  }

  if (attention.length) {
    parts.push(`Focus areas include ${listStates(attention)} based on available trend data and week-ending performance.`);
  }

  return parts.join(" ");
}

function generateEmailDraft(report: {
  weekEnding: string | null;
  overallPerformance: number | null;
  contextNote: string | null;
  rows: CotpParsedRow[];
  executiveSummary: string;
}) {
  const takeaways = generateKeyTakeaways(report.rows);
  const attention = [
    ...(takeaways["Needs Attention"] ?? []),
    ...(takeaways["Watch Closely"] ?? []),
  ];

  return {
    subject: `COTP Performance Update${report.weekEnding ? ` – Week Ending ${report.weekEnding}` : ""}`,
    body: [
      "Team,",
      "",
      report.executiveSummary,
      "",
      attention.length
        ? `Please continue monitoring current-week trends closely, with priority follow-up in ${attention.join(", ")}.`
        : "Please continue monitoring current-week trends closely and maintain focus on states showing movement.",
      "",
      "Best,",
    ].join("\n"),
  };
}

export function generateCotpReport(rawText: string): CotpGeneratedReport {
  const lines = normalizeInput(rawText);
  const header = parseHeader(lines);
  const parsed = parseRows(lines);

  if (!header) {
    throw new Error("We could not identify the COTP report header. Please confirm the pasted text includes the COTP summary line with week and overall percentage.");
  }

  if (!parsed.rows.length) {
    throw new Error("We could not identify state-level performance rows. Please confirm the pasted text includes state abbreviations, week-ending percentages, direction, and prior week values.");
  }

  const base = {
    ...header,
    rows: parsed.rows,
  };

  const executiveSummary = generateExecutiveSummary(base);
  const emailDraft = generateEmailDraft({ ...base, executiveSummary });

  return {
    ...base,
    executiveSummary,
    keyTakeaways: generateKeyTakeaways(parsed.rows),
    emailDraft,
    warnings: parsed.warnings,
    skippedLines: parsed.skippedLines,
  };
}
