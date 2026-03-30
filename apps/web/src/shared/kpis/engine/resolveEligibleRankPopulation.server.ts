import { supabaseServer } from "@/shared/data/supabase/server";
import type { RankInputRow } from "@/shared/kpis/contracts/rankTypes";

type ReportClassType = "P4P" | "SMART" | "TECH";

type Args = {
  pc_org_ids: string[];
  class_type: ReportClassType;
  batch_id?: string | null;
};

type ActivePopulationRow = {
  tech_id: string | null;
  person_id: string | null;
  composite_score: number | null;
  direct_reports_to_person_id: string | null;
  pc_org_id: string | null;
  co_code: string | null;
  metric_date: string | null;
  created_at: string | null;
  raw_metrics_json: unknown;
};

type PcOrgAdminRow = {
  pc_org_id: string | null;
  region_id: string | null;
};

type DivisionAdminRow = {
  division_id: string | null;
  division_code: string | null;
};

function toTrimmedString(value: unknown) {
  const out = String(value ?? "").trim();
  return out || null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractFtrContactJobs(rawMetricsJson: unknown): number | null {
  if (!rawMetricsJson) return null;

  if (typeof rawMetricsJson === "string") {
    try {
      const parsed = JSON.parse(rawMetricsJson);
      return extractFtrContactJobs(parsed);
    } catch {
      return null;
    }
  }

  if (typeof rawMetricsJson === "object" && rawMetricsJson !== null) {
    const record = rawMetricsJson as Record<string, unknown>;
    return parseNumber(record["Total FTR/Contact Jobs"]);
  }

  return null;
}

function compareIsoDesc(a: string | null, b: string | null) {
  const av = a ? new Date(a).getTime() : Number.NEGATIVE_INFINITY;
  const bv = b ? new Date(b).getTime() : Number.NEGATIVE_INFINITY;
  return bv - av;
}

function choosePreferredRow(
  current: ActivePopulationRow,
  candidate: ActivePopulationRow
) {
  const metricDateCompare = compareIsoDesc(
    current.metric_date,
    candidate.metric_date
  );
  if (metricDateCompare !== 0) {
    return metricDateCompare > 0 ? current : candidate;
  }

  const createdAtCompare = compareIsoDesc(
    current.created_at,
    candidate.created_at
  );
  if (createdAtCompare !== 0) {
    return createdAtCompare > 0 ? current : candidate;
  }

  const currentTech = String(current.tech_id ?? "");
  const candidateTech = String(candidate.tech_id ?? "");
  return currentTech.localeCompare(candidateTech) <= 0 ? current : candidate;
}

/**
 * Current enforced rules:
 * 1) unique person_id
 * 2) open assignment only (inherited from current active population view)
 * 3) positive Total FTR/Contact Jobs
 * 4) class container filter
 * 5) latest row wins inside selected context
 */
export async function resolveEligibleRankPopulation(
  args: Args
): Promise<RankInputRow[]> {
  const supabase = await supabaseServer();

  const pcOrgIds = Array.from(
    new Set(
      (args.pc_org_ids ?? [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );

  if (!pcOrgIds.length) return [];

  let populationQuery = supabase
    .from("v_metrics_active_population")
    .select(
      `
      tech_id,
      person_id,
      composite_score,
      direct_reports_to_person_id,
      pc_org_id,
      co_code,
      metric_date,
      created_at,
      raw_metrics_json
    `
    )
    .in("pc_org_id", pcOrgIds)
    .eq("class_type", args.class_type)
    .eq("is_outlier", false);

  if (args.batch_id) {
    populationQuery = populationQuery.eq("batch_id", args.batch_id);
  }

  const [
    { data: populationRows, error: populationError },
    { data: pcOrgRows, error: pcOrgError },
    { data: divisionRows, error: divisionError },
  ] = await Promise.all([
    populationQuery,
    supabase
      .from("pc_org_admin_v")
      .select(
        `
        pc_org_id,
        region_id
      `
      )
      .in("pc_org_id", pcOrgIds),
    supabase
      .from("division_admin_v")
      .select(
        `
        division_id,
        division_code
      `
      ),
  ]);

  if (populationError) {
    throw new Error(
      `resolveEligibleRankPopulation failed loading v_metrics_active_population: ${populationError.message}`
    );
  }

  if (pcOrgError) {
    throw new Error(
      `resolveEligibleRankPopulation failed loading pc_org_admin_v: ${pcOrgError.message}`
    );
  }

  if (divisionError) {
    throw new Error(
      `resolveEligibleRankPopulation failed loading division_admin_v: ${divisionError.message}`
    );
  }

  const regionByPcOrg = new Map<string, string>();
  for (const row of (pcOrgRows ?? []) as PcOrgAdminRow[]) {
    const pcOrgId = toTrimmedString(row.pc_org_id);
    const regionId = toTrimmedString(row.region_id);
    if (!pcOrgId || !regionId) continue;
    regionByPcOrg.set(pcOrgId, regionId);
  }

  const divisionIdByCode = new Map<string, string>();
  for (const row of (divisionRows ?? []) as DivisionAdminRow[]) {
    const divisionCode = toTrimmedString(row.division_code);
    const divisionId = toTrimmedString(row.division_id);
    if (!divisionCode || !divisionId) continue;
    divisionIdByCode.set(divisionCode, divisionId);
  }

  const bestRowByPersonId = new Map<string, ActivePopulationRow>();

  for (const row of (populationRows ?? []) as ActivePopulationRow[]) {
    const personId = toTrimmedString(row.person_id);
    const techId = toTrimmedString(row.tech_id);
    const pcOrgId = toTrimmedString(row.pc_org_id);

    if (!personId || !techId || !pcOrgId) continue;

    const compositeScore = parseNumber(row.composite_score);
    if (compositeScore == null) continue;

    const ftrContactJobs = extractFtrContactJobs(row.raw_metrics_json);
    if (ftrContactJobs == null || ftrContactJobs <= 0) continue;

    const existing = bestRowByPersonId.get(personId);
    if (!existing) {
      bestRowByPersonId.set(personId, row);
      continue;
    }

    bestRowByPersonId.set(personId, choosePreferredRow(existing, row));
  }

  const out: RankInputRow[] = [];

  for (const row of bestRowByPersonId.values()) {
    const personId = toTrimmedString(row.person_id);
    const techId = toTrimmedString(row.tech_id);
    const pcOrgId = toTrimmedString(row.pc_org_id);
    const coCode = toTrimmedString(row.co_code);

    if (!personId || !techId || !pcOrgId) continue;

    out.push({
      person_id: personId,
      tech_id: techId,
      composite_score: parseNumber(row.composite_score),
      team_key: toTrimmedString(row.direct_reports_to_person_id),
      region_key: regionByPcOrg.get(pcOrgId) ?? null,
      division_key: coCode ? divisionIdByCode.get(coCode) ?? null : null,
      tiebreak_value: null,
      tiebreak_direction: "HIGHER_BETTER",
      fallback_value: null,
    });
  }

  return out;
}