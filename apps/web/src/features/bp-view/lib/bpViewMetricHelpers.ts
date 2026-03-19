import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";

type RubricRow = {
  kpi_key: string;
  band_key: BandKey;
  min_value: number | null;
  max_value: number | null;
};

type FactRow = {
  tech_id: string | null;
  metric_date: string | null;
  fiscal_end_date: string | null;
  [key: string]: unknown;
};

export function numOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export function bandLabel(band: BandKey) {
  switch (band) {
    case "EXCEEDS":
      return "Exceeds";
    case "MEETS":
      return "Meets";
    case "NEEDS_IMPROVEMENT":
      return "Needs Improvement";
    case "MISSES":
      return "Misses";
    default:
      return "No Data";
  }
}

export function pickBand(
  value: number | null,
  bands: RubricRow[] | undefined
): BandKey {
  if (value == null || !bands?.length) return "NO_DATA";

  for (const b of bands) {
    const minOk = b.min_value == null || value >= b.min_value;
    const maxOk = b.max_value == null || value <= b.max_value;
    if (minOk && maxOk) return b.band_key;
  }

  return "NO_DATA";
}

export function formatValueDisplay(
  kpiKey: string,
  value: number | null
): string | null {
  if (value == null) return null;

  const lower = kpiKey.toLowerCase();
  const looksLikeRate =
    lower.endsWith("_rate") ||
    lower.endsWith("_pct") ||
    lower.includes("rate") ||
    lower.includes("pct") ||
    lower.includes("usage") ||
    lower.includes("pass") ||
    lower.includes("met");

  if (looksLikeRate) {
    const pct = value <= 1.5 ? value * 100 : value;
    return `${pct.toFixed(pct >= 10 ? 1 : 2)}%`;
  }

  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export function monthsBack(range: "FM" | "3FM" | "12FM") {
  if (range === "12FM") return 12;
  if (range === "3FM") return 3;
  return 1;
}

export function monthWindowStart(range: "FM" | "3FM" | "12FM") {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  start.setUTCMonth(start.getUTCMonth() - (monthsBack(range) - 1));
  return start.toISOString().slice(0, 10);
}

export function latestFactByTech(rows: FactRow[]): Map<string, FactRow> {
  const out = new Map<string, FactRow>();

  for (const row of rows) {
    const tech_id = row.tech_id ? String(row.tech_id) : null;
    if (!tech_id) continue;

    const current = out.get(tech_id);
    if (!current) {
      out.set(tech_id, row);
      continue;
    }

    const currentDate = String(current.metric_date ?? "");
    const nextDate = String(row.metric_date ?? "");
    if (nextDate > currentDate) out.set(tech_id, row);
  }

  return out;
}