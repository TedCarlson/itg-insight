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

type FactRow = {
  [key: string]: unknown;
};

type WorkMixRow = {
  installs: number;
  tcs: number;
  sros: number;
  total: number;
};

type Params = {
  scopedAssignments: any[];
  peopleById: Map<string, any>;
  factByTech: Map<string, FactRow>;
  kpis: KpiCfg[];
  rubricByKpi: Map<string, RubricRow[]>;
  orgLabelsById: Map<string, string>;
  workMixByTech: Map<string, WorkMixRow>;
  kpiOverrides?: Record<string, Map<string, number | null>>;
};

function formatValue(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;

  if (value >= 10) return value.toFixed(1);
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

function parseRawFactValue(value: unknown): Record<string, unknown> | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return null;
}

function extractFromFact(fact: FactRow, kpiKey: string): number | null {
  if (!fact) return null;

  const directRaw = fact?.[kpiKey];
  if (directRaw != null) {
    const directNum = Number(directRaw);
    if (Number.isFinite(directNum)) return directNum;
  }

  const raw = parseRawFactValue(fact.raw);
  if (!raw) return null;

  const rawFieldMap: Record<string, string[]> = {
    tnps: ["tNPS Rate", "tnps", "tnps_score", "tNPS"],
    tnps_score: ["tNPS Rate", "tnps_score", "tnps", "tNPS"],

    ftr_rate: ["FTR%", "ftr_rate", "FTR Rate"],

    tool_usage: ["ToolUsage", "Tool Usage", "tool_usage", "tool_usage_rate"],
    tool_usage_rate: ["ToolUsage", "Tool Usage", "tool_usage_rate", "tool_usage"],

    pure_pass: ["PHT Pure Pass%", "pure_pass", "pure_pass_rate", "pht_pure_pass_rate"],
    pure_pass_rate: ["PHT Pure Pass%", "pure_pass_rate", "pure_pass", "pht_pure_pass_rate"],
    pht_pure_pass_rate: ["PHT Pure Pass%", "pht_pure_pass_rate", "pure_pass_rate", "pure_pass"],

    contact_48hr: [
      "48Hr Contact Rate%",
      "contact_48hr",
      "contact_48hr_rate",
      "callback_rate_48hr",
    ],
    contact_48hr_rate: [
      "48Hr Contact Rate%",
      "contact_48hr_rate",
      "contact_48hr",
      "callback_rate_48hr",
    ],
    callback_rate_48hr: [
      "48Hr Contact Rate%",
      "callback_rate_48hr",
      "contact_48hr_rate",
      "contact_48hr",
    ],

    repeat: ["Repeat Rate%", "repeat", "repeat_rate"],
    repeat_rate: ["Repeat Rate%", "repeat_rate", "repeat"],

    rework: ["Rework Rate%", "rework", "rework_rate"],
    rework_rate: ["Rework Rate%", "rework_rate", "rework"],

    soi: ["SOI Rate%", "soi", "soi_rate"],
    soi_rate: ["SOI Rate%", "soi_rate", "soi"],

    met: ["MetRate", "met", "met_rate"],
    met_rate: ["MetRate", "met_rate", "met"],
  };

  const candidateKeys = rawFieldMap[kpiKey] ?? [kpiKey];

  for (const candidateKey of candidateKeys) {
    const value = raw[candidateKey];
    if (value == null) continue;

    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function firstNameOnly(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "Unknown";

  const first = trimmed.split(/\s+/)[0]?.trim();
  return first || "Unknown";
}

export function buildBpRosterRows(params: Params): BpViewRosterRow[] {
  const {
    scopedAssignments,
    peopleById,
    factByTech,
    kpis,
    rubricByKpi,
    orgLabelsById,
    workMixByTech,
    kpiOverrides,
  } = params;

  const rows: BpViewRosterRow[] = [];

  for (const assignment of scopedAssignments) {
    const techId = String(assignment.tech_id ?? "");
    if (!techId) continue;

    const person = peopleById.get(String(assignment.person_id ?? ""));
    const fact = factByTech.get(techId);

    const metrics: BpViewRosterMetricCell[] = [];
    let belowTargetCount = 0;

    for (const kpi of kpis) {
      let value: number | null = null;

      const overrideMap = kpiOverrides?.[kpi.kpi_key];

      if (overrideMap) {
        value = overrideMap.get(techId) ?? null;
      } else if (fact) {
        value = extractFromFact(fact, kpi.kpi_key);
      }

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

    const orgLabel =
      orgLabelsById.get(String(assignment.pc_org_id ?? "")) ??
      String(assignment.pc_org_id ?? "");

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
      person_id: String(assignment.person_id ?? ""),
      tech_id: techId,
      full_name: fullNameWithTechId,
      context: orgLabel,
      rank: null,
      metrics,
      below_target_count: belowTargetCount,
      work_mix,
    });
  }

  return rows;
}