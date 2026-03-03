export type DeltaTrend = "UP" | "DOWN" | "FLAT" | null;

export type P4PTileRollup = {
  tech_ids: string[];

  // Fact sums (atomic truth)
  tnps_surveys: number;
  tnps_promoters: number;
  tnps_detractors: number;

  ftr_contact_jobs: number;
  ftr_fail_jobs: number;

  tu_eligible_jobs: number;
  tu_compliant_jobs: number;

  // Derived KPIs (what tiles should display)
  tnps_rate: number | null; // 0-100
  ftr_rate: number | null; // 0-100
  tool_usage_rate: number | null; // 0-100
};

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Exclude any Totals-like tech_id rows from math.
 */
export function isTotalsRow(row: any): boolean {
  const tech = String(row?.tech_id ?? "").toLowerCase();
  return tech.includes("totals");
}

/**
 * Pull a number from:
 *  - explicit columns (preferred)
 *  - raw_metrics_json / computed_metrics_json (fallback)
 */
function pickNum(row: any, keys: string[]): number | null {
  for (const k of keys) {
    const direct = toNum(row?.[k]);
    if (direct != null) return direct;

    const raw = row?.raw_metrics_json;
    const comp = row?.computed_metrics_json;

    const rawVal = raw && typeof raw === "object" ? toNum((raw as any)[k]) : null;
    if (rawVal != null) return rawVal;

    // computed can store { value: ... }
    if (comp && typeof comp === "object") {
      const v = (comp as any)[k];
      if (v != null && typeof v === "object") {
        const vv = toNum((v as any).value);
        if (vv != null) return vv;
      }
      const compVal = toNum((comp as any)[k]);
      if (compVal != null) return compVal;
    }
  }
  return null;
}

function distinctTechIds(rows: any[]): string[] {
  const s = new Set<string>();
  for (const r of rows ?? []) {
    const id = String(r?.tech_id ?? "").trim();
    if (!id) continue;
    if (isTotalsRow(r)) continue;
    s.add(id);
  }
  return Array.from(s.values()).sort();
}

/**
 * FACT-DRIVEN rollup for tiles.
 *
 * tNPS Rate:
 *   100 * (promoters - detractors) / surveys   (if surveys > 0)
 *
 * Tool Usage:
 *   100 * compliant / eligible                 (if eligible > 0)
 *   (compliant == TUResult; eligible == TUEligibleJobs)
 *
 * FTR%:
 *   100 * (1 - fails / contact_jobs)           (if contact_jobs > 0)
 *
 * Tail-rule handling:
 *   if contact_jobs == 0 but fails > 0 => return 0 (fails happened; worst-case)
 *   if contact_jobs == 0 and fails == 0 => null (no signal)
 */
export function computeP4PTileRollup(rows: any[]): P4PTileRollup {
  const scoped = (rows ?? []).filter((r) => !isTotalsRow(r));

  let tnps_surveys = 0;
  let tnps_promoters = 0;
  let tnps_detractors = 0;

  let ftr_contact_jobs = 0;
  let ftr_fail_jobs = 0;

  let tu_eligible_jobs = 0;
  let tu_compliant_jobs = 0;

  for (const r of scoped) {
    // tNPS facts
    const surveys = pickNum(r, ["tnps_surveys", "tNPS Surveys", "tNPS_Surveys", "Surveys"]);
    const promoters = pickNum(r, ["tnps_promoters", "Promoters"]);
    const detractors = pickNum(r, ["tnps_detractors", "Detractors"]);

    if (surveys != null && surveys > 0) {
      tnps_surveys += surveys;
      if (promoters != null) tnps_promoters += promoters;
      if (detractors != null) tnps_detractors += detractors;
    }

    // FTR facts (+ tail rule)
    const contactJobs = pickNum(r, ["total_ftr_contact_jobs", "Total FTR/Contact Jobs", "ftr_contact_jobs"]);
    const failJobs = pickNum(r, ["ftr_fail_jobs", "FTRFailJobs", "FTR Fail Jobs"]);

    if (contactJobs != null && contactJobs > 0) {
      ftr_contact_jobs += contactJobs;
      if (failJobs != null && failJobs > 0) ftr_fail_jobs += failJobs;
    } else {
      if (failJobs != null && failJobs > 0) ftr_fail_jobs += failJobs;
    }

    // Tool usage facts
    const eligible = pickNum(r, ["tu_eligible_jobs", "TUEligibleJobs", "TU Eligible Jobs"]);
    const compliant = pickNum(r, ["tu_compliant_jobs", "TUResult", "TU Result", "tu_result"]);

    if (eligible != null && eligible > 0) {
      tu_eligible_jobs += eligible;
      if (compliant != null) tu_compliant_jobs += compliant;
    }
  }

  const tnps_rate =
    tnps_surveys > 0 ? (100 * (tnps_promoters - tnps_detractors)) / tnps_surveys : null;

  let ftr_rate: number | null = null;
  if (ftr_contact_jobs > 0) {
    ftr_rate = 100 * (1 - ftr_fail_jobs / ftr_contact_jobs);
  } else if (ftr_fail_jobs > 0) {
    ftr_rate = 0;
  }

  const tool_usage_rate =
    tu_eligible_jobs > 0 ? (100 * tu_compliant_jobs) / tu_eligible_jobs : null;

  return {
    tech_ids: distinctTechIds(scoped),

    tnps_surveys,
    tnps_promoters,
    tnps_detractors,

    ftr_contact_jobs,
    ftr_fail_jobs,

    tu_eligible_jobs,
    tu_compliant_jobs,

    tnps_rate: tnps_rate != null && Number.isFinite(tnps_rate) ? tnps_rate : null,
    ftr_rate: ftr_rate != null && Number.isFinite(ftr_rate) ? ftr_rate : null,
    tool_usage_rate: tool_usage_rate != null && Number.isFinite(tool_usage_rate) ? tool_usage_rate : null,
  };
}

export function trendFromDelta(d: number | null, eps = 0.000001): DeltaTrend {
  if (d == null || !Number.isFinite(d)) return null;
  if (Math.abs(d) <= eps) return "FLAT";
  return d > 0 ? "UP" : "DOWN";
}

export function delta(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null) return null;
  const d = current - prior;
  return Number.isFinite(d) ? d : null;
}

// ✅ re-added for ReportingTable import compatibility
export function fmtValue(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

// ✅ this is the missing export your build is failing on
export function fmtDelta(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Number(n.toFixed(digits));
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}`;
}

export function trendGlyph(t: DeltaTrend): string {
  if (t === "UP") return "↑";
  if (t === "DOWN") return "↓";
  if (t === "FLAT") return "→";
  return "";
}