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
};

type PcOrgAdminRow = {
  pc_org_id: string | null;
  region_id: string | null;
};

type DivisionAdminRow = {
  division_id: string | null;
  division_code: string | null;
  division_name: string | null;
};

function toMaybeString(value: unknown) {
  const out = String(value ?? "").trim();
  return out || null;
}

export async function loadRankPopulation(
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
      is_outlier,
      batch_id,
      class_type
    `
    )
    .in("pc_org_id", pcOrgIds)
    .eq("is_outlier", false)
    .eq("class_type", args.class_type);

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
        division_code,
        division_name
      `
      ),
  ]);

  if (populationError) {
    throw new Error(
      `loadRankPopulation failed loading v_metrics_active_population: ${populationError.message}`
    );
  }

  if (pcOrgError) {
    throw new Error(
      `loadRankPopulation failed loading pc_org_admin_v: ${pcOrgError.message}`
    );
  }

  if (divisionError) {
    throw new Error(
      `loadRankPopulation failed loading division_admin_v: ${divisionError.message}`
    );
  }

  const regionByPcOrg = new Map<string, string>();
  for (const row of (pcOrgRows ?? []) as PcOrgAdminRow[]) {
    const pcOrgId = toMaybeString(row.pc_org_id);
    const regionId = toMaybeString(row.region_id);
    if (!pcOrgId || !regionId) continue;
    regionByPcOrg.set(pcOrgId, regionId);
  }

  const divisionIdByCode = new Map<string, string>();
  for (const row of (divisionRows ?? []) as DivisionAdminRow[]) {
    const divisionCode = toMaybeString(row.division_code);
    const divisionId = toMaybeString(row.division_id);
    if (!divisionCode || !divisionId) continue;
    divisionIdByCode.set(divisionCode, divisionId);
  }

  const out: RankInputRow[] = [];

  for (const row of (populationRows ?? []) as ActivePopulationRow[]) {
    const techId = toMaybeString(row.tech_id);
    const personId = toMaybeString(row.person_id);
    const pcOrgId = toMaybeString(row.pc_org_id);
    const coCode = toMaybeString(row.co_code);

    if (!techId || !personId || !pcOrgId) continue;

    out.push({
      person_id: personId,
      tech_id: techId,
      composite_score:
        typeof row.composite_score === "number" &&
        Number.isFinite(row.composite_score)
          ? row.composite_score
          : null,
      team_key: toMaybeString(row.direct_reports_to_person_id),
      region_key: regionByPcOrg.get(pcOrgId) ?? null,
      division_key: coCode ? divisionIdByCode.get(coCode) ?? null : null,
      tiebreak_value: null,
      tiebreak_direction: "HIGHER_BETTER",
      fallback_value: null,
    });
  }

  return out;
}