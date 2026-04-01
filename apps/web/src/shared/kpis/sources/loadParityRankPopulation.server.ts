import { supabaseServer } from "@/shared/data/supabase/server";
import type { RankInputRow } from "@/shared/kpis/contracts/rankTypes";

type ReportClassType = "P4P" | "SMART" | "TECH";

type ScopedAssignmentLike = {
  tech_id?: string | null;
  contractor_name?: string | null;
};

type Args = {
  pc_org_ids: string[];
  class_type: ReportClassType;
  scoped_assignments: ScopedAssignmentLike[];
  batch_id?: string | null;
};

type ActivePopulationRow = {
  tech_id: string | null;
  composite_score: number | null;
  pc_org_id: string | null;
};

type GroupBucket = {
  stable_key: string;
  composite_scores: number[];
};

function toMaybeString(value: unknown) {
  const out = String(value ?? "").trim();
  return out || null;
}

function toParityStableKey(contractorName: string | null) {
  const contractor = toMaybeString(contractorName);
  if (contractor) {
    return `CONTRACTOR::${contractor}`;
  }
  return "COMPANY::In-House";
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function loadParityRankPopulation(
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

  const groupKeyByTechId = new Map<string, string>();
  for (const assignment of args.scoped_assignments ?? []) {
    const techId = toMaybeString(assignment.tech_id);
    if (!techId) continue;

    groupKeyByTechId.set(
      techId,
      toParityStableKey(toMaybeString(assignment.contractor_name))
    );
  }

  if (!groupKeyByTechId.size) return [];

  let query = supabase
    .from("v_metrics_active_population")
    .select(
      `
      tech_id,
      composite_score,
      pc_org_id,
      is_outlier,
      batch_id,
      class_type
    `
    )
    .in("pc_org_id", pcOrgIds)
    .eq("is_outlier", false)
    .eq("class_type", args.class_type);

  if (args.batch_id) {
    query = query.eq("batch_id", args.batch_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `loadParityRankPopulation failed loading v_metrics_active_population: ${error.message}`
    );
  }

  const buckets = new Map<string, GroupBucket>();

  for (const row of (data ?? []) as ActivePopulationRow[]) {
    const techId = toMaybeString(row.tech_id);
    if (!techId) continue;

    const stableKey = groupKeyByTechId.get(techId);
    if (!stableKey) continue;

    const composite =
      typeof row.composite_score === "number" &&
      Number.isFinite(row.composite_score)
        ? row.composite_score
        : null;

    if (composite == null) continue;

    const bucket = buckets.get(stableKey) ?? {
      stable_key: stableKey,
      composite_scores: [],
    };

    bucket.composite_scores.push(composite);
    buckets.set(stableKey, bucket);
  }

  const out: RankInputRow[] = [];

  for (const bucket of buckets.values()) {
    out.push({
      person_id: bucket.stable_key,
      tech_id: bucket.stable_key,
      composite_score: average(bucket.composite_scores),
      team_key: "__PARITY__",
      region_key: null,
      division_key: null,
      tiebreak_value: null,
      tiebreak_direction: "HIGHER_BETTER",
      fallback_value: null,
    });
  }

  return out;
}