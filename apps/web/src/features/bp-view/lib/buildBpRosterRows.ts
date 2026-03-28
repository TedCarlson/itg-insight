import type {
  BpViewRosterRow,
  BpViewRosterMetricCell,
} from "./bpView.types";
import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";

type KpiCfg = {
  kpi_key: string;
  label: string;
};

type RubricRow = {
  kpi_key: string;
  band_key: BandKey;
  min_value: number | null;
  max_value: number | null;
};

type WorkMixRow = {
  installs: number;
  tcs: number;
  sros: number;
  total: number;
};

type KpiOverrideMap = Map<string, number | null>;
type KpiOverrideRecord = Record<string, KpiOverrideMap>;

type Params = {
  scopedAssignments: any[];
  peopleById: Map<string, any>;
  kpis: KpiCfg[];
  rubricByKpi: Map<string, RubricRow[]>;
  orgLabelsById: Map<string, string>;
  workMixByTech: Map<string, WorkMixRow>;
  kpiOverrides?: KpiOverrideRecord | Map<string, KpiOverrideMap>;
};

function formatValue(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function resolveBand(value: number | null, rubric?: RubricRow[]): BandKey {
  if (value == null || !rubric?.length) return "NO_DATA" as BandKey;

  for (const r of rubric) {
    const minOk = r.min_value == null || value >= r.min_value;
    const maxOk = r.max_value == null || value <= r.max_value;

    if (minOk && maxOk) {
      return r.band_key;
    }
  }

  return "NO_DATA" as BandKey;
}

function getKpiAliases(kpiKey: string): string[] {
  const key = kpiKey.trim().toLowerCase();

  const aliasMap: Record<string, string[]> = {
    tnps: ["tnps", "tnps_score"],
    tnps_score: ["tnps_score", "tnps"],

    ftr: ["ftr", "ftr_rate"],
    ftr_rate: ["ftr_rate", "ftr"],

    tool_usage: ["tool_usage", "tool_usage_rate", "toolusage", "tu_rate"],
    tool_usage_rate: ["tool_usage_rate", "tool_usage", "toolusage", "tu_rate"],
    toolusage: ["toolusage", "tool_usage", "tool_usage_rate", "tu_rate"],
    tu_rate: ["tu_rate", "tool_usage", "tool_usage_rate", "toolusage"],

    pure_pass: ["pure_pass", "pure_pass_rate", "pht_pure_pass_rate", "purepass"],
    pure_pass_rate: ["pure_pass_rate", "pure_pass", "pht_pure_pass_rate", "purepass"],
    pht_pure_pass_rate: ["pht_pure_pass_rate", "pure_pass_rate", "pure_pass", "purepass"],
    purepass: ["purepass", "pure_pass", "pure_pass_rate", "pht_pure_pass_rate"],

    contact_48hr: ["contact_48hr", "contact_48hr_rate", "callback_rate_48hr", "48hr_contact", "48_hr_contact", "callback_48hr"],
    contact_48hr_rate: ["contact_48hr_rate", "contact_48hr", "callback_rate_48hr", "48hr_contact", "48_hr_contact", "callback_48hr"],
    callback_rate_48hr: ["callback_rate_48hr", "contact_48hr_rate", "contact_48hr", "48hr_contact", "48_hr_contact", "callback_48hr"],
    "48hr_contact": ["48hr_contact", "contact_48hr", "contact_48hr_rate", "callback_rate_48hr", "48_hr_contact", "callback_48hr"],
    "48_hr_contact": ["48_hr_contact", "48hr_contact", "contact_48hr", "contact_48hr_rate", "callback_rate_48hr", "callback_48hr"],
    callback_48hr: ["callback_48hr", "callback_rate_48hr", "contact_48hr_rate", "contact_48hr", "48hr_contact", "48_hr_contact"],

    repeat: ["repeat", "repeat_rate"],
    repeat_rate: ["repeat_rate", "repeat"],

    rework: ["rework", "rework_rate"],
    rework_rate: ["rework_rate", "rework"],

    soi: ["soi", "soi_rate"],
    soi_rate: ["soi_rate", "soi"],

    met: ["met", "met_rate"],
    met_rate: ["met_rate", "met"],
  };

  return aliasMap[key] ?? [key];
}

function getOverrideMap(
  kpiOverrides: Params["kpiOverrides"],
  kpiKey: string
): KpiOverrideMap | null {
  if (!kpiOverrides) return null;

  const aliases = getKpiAliases(kpiKey);

  if (kpiOverrides instanceof Map) {
    for (const alias of aliases) {
      const found = kpiOverrides.get(alias);
      if (found) return found;
    }
    return null;
  }

  for (const alias of aliases) {
    const found = kpiOverrides[alias];
    if (found) return found;
  }

  return null;
}

function resolveMetricValue(args: {
  techId: string;
  kpiKey: string;
  kpiOverrides?: Params["kpiOverrides"];
}): number | null {
  const overrideMap = getOverrideMap(args.kpiOverrides, args.kpiKey);
  if (overrideMap?.has(args.techId)) {
    return overrideMap.get(args.techId) ?? null;
  }

  return null;
}

function firstNameOnly(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "Unknown";

  const first = trimmed.split(/\s+/)[0]?.trim();
  return first || "Unknown";
}

function resolveOfficeLabel(args: {
  assignment: any;
  orgLabelsById: Map<string, string>;
}) {
  const { assignment, orgLabelsById } = args;

  const directOffice =
    assignment?.office_name ??
    assignment?.office ??
    assignment?.market_name ??
    assignment?.market ??
    assignment?.branch_name ??
    assignment?.branch ??
    null;

  if (directOffice != null && String(directOffice).trim()) {
    return String(directOffice).trim();
  }

  const pcOrgId = String(assignment?.pc_org_id ?? "").trim();

  if (pcOrgId && orgLabelsById.has(pcOrgId)) {
    return orgLabelsById.get(pcOrgId) ?? pcOrgId;
  }

  return pcOrgId || "Unknown";
}

export function buildBpRosterRows(params: Params): BpViewRosterRow[] {
  const {
    scopedAssignments,
    peopleById,
    kpis,
    rubricByKpi,
    orgLabelsById,
    workMixByTech,
    kpiOverrides,
  } = params;

  const rows: BpViewRosterRow[] = [];

  for (const assignment of scopedAssignments) {
    const techId = String(assignment.tech_id ?? "").trim();
    if (!techId) continue;

    const personId = String(assignment.person_id ?? "").trim();
    const person = peopleById.get(personId);

    const metrics: BpViewRosterMetricCell[] = [];
    let belowTargetCount = 0;

    for (const kpi of kpis) {
      const value = resolveMetricValue({
        techId,
        kpiKey: kpi.kpi_key,
        kpiOverrides,
      });

      const band = resolveBand(value, rubricByKpi.get(kpi.kpi_key));

      if (band === "MISSES" || band === "NEEDS_IMPROVEMENT") {
        belowTargetCount++;
      }

      metrics.push({
        kpi_key: kpi.kpi_key,
        label: kpi.label,
        value,
        value_display: formatValue(value),
        band_key: band,
        delta_value: null,
        delta_display: null,
        rank_value: null,
        rank_display: null,
        rank_delta_value: null,
        rank_delta_display: null,
        score_value: null,
        score_weight: null,
        score_contribution: null,
      });
    }

    const officeLabel = resolveOfficeLabel({
      assignment,
      orgLabelsById,
    });

    const resolvedFullName = String(person?.full_name ?? "Unknown");
    const shortName = firstNameOnly(resolvedFullName);
    const fullNameWithTechId = `${shortName} • ${techId}`;

    const work_mix = workMixByTech.get(techId) ?? {
      installs: 0,
      tcs: 0,
      sros: 0,
      total: 0,
    };

    rows.push({
      person_id: personId,
      tech_id: techId,
      full_name: fullNameWithTechId,
      context: officeLabel,
      office_name: assignment?.office_name ?? officeLabel,
      leader_assignment_id: assignment?.leader_assignment_id ?? null,
      leader_person_id: assignment?.leader_person_id ?? null,
      leader_name: assignment?.leader_name ?? null,
      leader_title: assignment?.leader_title ?? null,
      contractor_name:
        "contractor_name" in assignment
          ? (assignment.contractor_name ?? null)
          : null,
      rank: null,
      metrics,
      below_target_count: belowTargetCount,
      work_mix,
    } as BpViewRosterRow);
  }

  return rows;
}