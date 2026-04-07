// path: src/shared/kpis/engine/resolveEligibleRankPopulation.server.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { resolveFiscalSelection } from "@/shared/kpis/core/rowSelection";
import type { MetricsRangeKey, RawMetricRow } from "@/shared/kpis/core/types";
import type {
  RankDirection,
  RankInputRow,
} from "@/shared/kpis/contracts/rankTypes";

type ReportClassType = "P4P" | "SMART" | "TECH";

type Args = {
  pc_org_ids: string[];
  class_type: ReportClassType;
  range: MetricsRangeKey;
  batch_id?: string | null;
  team_key_by_person?: Map<string, string>;
  allowed_person_ids?: string[];
};

type PopulationSeedRow = {
  tech_id: string | null;
  person_id: string | null;
  composite_score: number | null;
  direct_reports_to_person_id: string | null;
  pc_org_id: string | null;
  co_code: string | null;
  metric_date: string | null;
  fiscal_end_date: string | null;
  batch_id: string | null;
  created_at: string | null;
  metrics_json: unknown;
};

type RankCandidateRow = PopulationSeedRow &
  RawMetricRow & {
    metrics_json: unknown;
  };

type PcOrgAdminRow = {
  pc_org_id: string | null;
  region_id: string | null;
};

type DivisionAdminRow = {
  division_id: string | null;
  division_code: string | null;
};

type ClassConfigRow = {
  kpi_key: string | null;
  is_tiebreaker: boolean | null;
};

type KpiDefRow = {
  kpi_key: string | null;
  label: string | null;
  customer_label: string | null;
  raw_label_identifier: string | null;
  direction: string | null;
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

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_%]/g, "");
}

function extractRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function extractMetricValue(
  metricsJson: unknown,
  def: KpiDefRow | null
): number | null {
  const record = extractRecord(metricsJson);
  if (!Object.keys(record).length) return null;

  const candidateKeys = [
    def?.raw_label_identifier,
    def?.customer_label,
    def?.label,
    def?.kpi_key,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  for (const key of candidateKeys) {
    const direct = parseNumber(record[key]);
    if (direct != null) return direct;
  }

  const normalizedCandidates = candidateKeys.map(normalizeToken);

  for (const [key, value] of Object.entries(record)) {
    if (normalizedCandidates.includes(normalizeToken(key))) {
      const parsed = parseNumber(value);
      if (parsed != null) return parsed;
    }
  }

  return null;
}

function extractTotalJobs(metricsJson: unknown): number | null {
  const record = extractRecord(metricsJson);

  return (
    parseNumber(record["Total Jobs"]) ??
    parseNumber(record["total_jobs"]) ??
    parseNumber(record["jobs"]) ??
    null
  );
}

function extractRiskFlags(metricsJson: unknown): number | null {
  const record = extractRecord(metricsJson);

  return (
    parseNumber(record["below_target_count"]) ??
    parseNumber(record["risk_flags"]) ??
    parseNumber(record["risk_count"]) ??
    0
  );
}

function compareIsoDesc(a: string | null, b: string | null) {
  const av = a ? new Date(a).getTime() : Number.NEGATIVE_INFINITY;
  const bv = b ? new Date(b).getTime() : Number.NEGATIVE_INFINITY;
  return bv - av;
}

function choosePreferredRow(
  current: RankCandidateRow,
  candidate: RankCandidateRow
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

  const currentBatch = String(current.batch_id ?? "");
  const candidateBatch = String(candidate.batch_id ?? "");
  const batchCompare = candidateBatch.localeCompare(currentBatch);
  if (batchCompare !== 0) {
    return batchCompare > 0 ? candidate : current;
  }

  const currentTech = String(current.tech_id ?? "");
  const candidateTech = String(candidate.tech_id ?? "");
  return currentTech.localeCompare(candidateTech) <= 0 ? current : candidate;
}

function toRankCandidateRow(row: PopulationSeedRow): RankCandidateRow | null {
  const metric_date = toTrimmedString(row.metric_date);
  const fiscal_end_date = toTrimmedString(row.fiscal_end_date);
  const batch_id = toTrimmedString(row.batch_id);
  const inserted_at = toTrimmedString(row.created_at);
  const tech_id = toTrimmedString(row.tech_id);

  if (!metric_date || !fiscal_end_date || !batch_id || !inserted_at || !tech_id) {
    return null;
  }

  return {
    ...row,
    tech_id,
    metric_date,
    fiscal_end_date,
    batch_id,
    inserted_at,
    metrics_json: row.metrics_json,
    raw: {
      composite_score: parseNumber(row.composite_score),
      metrics_json: row.metrics_json,
    },
  };
}

function shiftTodayByMonths(monthsBack: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

function resolveRangeStartDate(range: MetricsRangeKey): string {
  if (range === "FM") return shiftTodayByMonths(0);
  if (range === "PREVIOUS") return shiftTodayByMonths(2);
  if (range === "3FM") return shiftTodayByMonths(3);
  if (range === "12FM") return shiftTodayByMonths(11);
  return "2000-01-01";
}

export async function resolveEligibleRankPopulation(
  args: Args
): Promise<RankInputRow[]> {
  const supabase = supabaseAdmin();

  const pcOrgIds = Array.from(
    new Set(
      (args.pc_org_ids ?? [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );

  if (!pcOrgIds.length) return [];

  const allowedPersonIds =
    args.allowed_person_ids && args.allowed_person_ids.length
      ? Array.from(
        new Set(
          args.allowed_person_ids
            .map((value) => String(value ?? "").trim())
            .filter(Boolean)
        )
      )
      : null;

  const startDate = resolveRangeStartDate(args.range);

  let populationSeedQuery = supabase
    .from("ui_master_metric_v2")
    .select(
      `
      tech_id,
      person_id,
      composite_score,
      direct_reports_to_person_id,
      pc_org_id,
      co_code,
      metric_date,
      fiscal_end_date,
      batch_id,
      created_at,
      metrics_json
    `
    )
    .in("pc_org_id", pcOrgIds)
    .eq("class_type", args.class_type)
    .eq("is_outlier", false)
    .gte("fiscal_end_date", startDate);

  if (args.batch_id) {
    populationSeedQuery = populationSeedQuery.eq("batch_id", args.batch_id);
  }

  if (allowedPersonIds?.length) {
    populationSeedQuery = populationSeedQuery.in("person_id", allowedPersonIds);
  }

  const [
    { data: populationSeedRows, error: populationSeedError },
    { data: pcOrgRows, error: pcOrgError },
    { data: divisionRows, error: divisionError },
    { data: classConfigRows, error: classConfigError },
    { data: kpiDefRows, error: kpiDefError },
  ] = await Promise.all([
    populationSeedQuery.limit(5000),
    supabase
      .from("pc_org_admin_v")
      .select("pc_org_id,region_id")
      .in("pc_org_id", pcOrgIds),
    supabase
      .from("division_admin_v")
      .select("division_id,division_code"),
    supabase
      .from("metrics_class_kpi_config")
      .select("kpi_key,is_tiebreaker")
      .eq("class_type", args.class_type)
      .eq("is_tiebreaker", true),
    supabase
      .from("metrics_kpi_def")
      .select("kpi_key,label,customer_label,raw_label_identifier,direction"),
  ]);

  if (populationSeedError) {
    throw new Error(
      `resolveEligibleRankPopulation failed loading ui_master_metric_v2 seed: ${populationSeedError.message}`
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

  if (classConfigError) {
    throw new Error(
      `resolveEligibleRankPopulation failed loading metrics_class_kpi_config: ${classConfigError.message}`
    );
  }

  if (kpiDefError) {
    throw new Error(
      `resolveEligibleRankPopulation failed loading metrics_kpi_def: ${kpiDefError.message}`
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

  const tiebreakerKpiKey =
    (classConfigRows as ClassConfigRow[] | null | undefined)?.[0]?.kpi_key
      ? String((classConfigRows as ClassConfigRow[])[0].kpi_key).trim()
      : null;

  const defByKey = new Map<string, KpiDefRow>();
  for (const row of (kpiDefRows ?? []) as KpiDefRow[]) {
    const key = toTrimmedString(row.kpi_key);
    if (!key) continue;
    defByKey.set(key, row);
  }

  const tiebreakerDef = tiebreakerKpiKey
    ? defByKey.get(tiebreakerKpiKey) ?? null
    : null;

  const tiebreakerDirection = (() => {
    const direction = toTrimmedString(tiebreakerDef?.direction);
    return direction === "LOWER_BETTER"
      ? ("LOWER_BETTER" as RankDirection)
      : ("HIGHER_BETTER" as RankDirection);
  })();

  const candidatesByPersonId = new Map<string, RankCandidateRow[]>();

  for (const row of (populationSeedRows ?? []) as PopulationSeedRow[]) {
    const personId = toTrimmedString(row.person_id);
    const techId = toTrimmedString(row.tech_id);
    const pcOrgId = toTrimmedString(row.pc_org_id);

    if (!personId || !techId || !pcOrgId) continue;

    const compositeScore = parseNumber(row.composite_score);
    if (compositeScore == null) continue;

    const candidate = toRankCandidateRow(row);
    if (!candidate) continue;

    const arr = candidatesByPersonId.get(personId) ?? [];
    arr.push(candidate);
    candidatesByPersonId.set(personId, arr);
  }

  const bestRowByPersonId = new Map<string, RankCandidateRow>();

  for (const [personId, rows] of candidatesByPersonId.entries()) {
    const { selectedFinalRows } = resolveFiscalSelection(rows, args.range);
    if (!selectedFinalRows.length) continue;

    let best = selectedFinalRows[0].row as RankCandidateRow;
    for (let i = 1; i < selectedFinalRows.length; i += 1) {
      best = choosePreferredRow(
        best,
        selectedFinalRows[i].row as RankCandidateRow
      );
    }

    bestRowByPersonId.set(personId, best);
  }

  if (!bestRowByPersonId.size) {
    return [];
  }

  const out: RankInputRow[] = [];

  for (const row of bestRowByPersonId.values()) {
    const personId = toTrimmedString(row.person_id);
    const techId = toTrimmedString(row.tech_id);
    const pcOrgId = toTrimmedString(row.pc_org_id);
    const coCode = toTrimmedString(row.co_code);

    if (!personId || !techId || !pcOrgId) continue;

    const teamKey =
      toTrimmedString(row.direct_reports_to_person_id) ??
      args.team_key_by_person?.get(personId) ??
      null;

    const metricsJson = row.metrics_json ?? null;

    const record = extractRecord(metricsJson);
    const hasKpis = Object.keys(record).length > 0;

    const composite = parseNumber(row.composite_score);

    let rowStatus: RankInputRow["row_resolution_status"];

    if (composite != null && !hasKpis) {
      rowStatus = "COMPOSITE_WITHOUT_KPI_PAYLOAD";
    } else if (hasKpis) {
      rowStatus = "KPI_PAYLOAD_PRESENT";
    } else {
      rowStatus = "NO_REPORTED_METRICS_IN_RANGE";
    }

    out.push({
      person_id: personId,
      tech_id: techId,
      composite_score: composite,
      team_key: teamKey,
      region_key: regionByPcOrg.get(pcOrgId) ?? null,
      division_key: coCode ? divisionIdByCode.get(coCode) ?? null : null,
      tiebreak_value: extractMetricValue(metricsJson, tiebreakerDef),
      tiebreak_direction: tiebreakerDirection,
      total_jobs: extractTotalJobs(metricsJson),
      risk_flags: extractRiskFlags(metricsJson),

      // 🔥 ADD THIS
      row_resolution_status: rowStatus,
    });
  }

  return out;
}