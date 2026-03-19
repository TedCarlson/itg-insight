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

type Params = {
  scopedAssignments: any[];
  peopleById: Map<string, any>;
  factByTech: Map<string, FactRow>;
  kpis: KpiCfg[];
  rubricByKpi: Map<string, RubricRow[]>;
  orgLabelsById: Map<string, string>;

  /**
   * 🔥 NEW: KPI override layer (tech-view style injection)
   */
  kpiOverrides?: Record<string, Map<string, number | null>>;
};

function formatValue(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;

  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function resolveBand(
  value: number | null,
  rubric?: RubricRow[]
): BandKey {
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

function extractFromFact(fact: FactRow, kpiKey: string): number | null {
  const raw = fact?.[kpiKey];
  if (raw == null) return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function buildBpRosterRows(params: Params): BpViewRosterRow[] {
  const {
    scopedAssignments,
    peopleById,
    factByTech,
    kpis,
    rubricByKpi,
    orgLabelsById,
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

      /**
       * 🔥 PRIORITY 1 — KPI OVERRIDE (REAL ENGINE)
       */
      const overrideMap = kpiOverrides?.[kpi.kpi_key];

      if (overrideMap) {
        value = overrideMap.get(techId) ?? null;
      } else if (fact) {
        /**
         * fallback to snapshot (temporary until all KPIs migrated)
         */
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
      });
    }

    const orgLabel =
      orgLabelsById.get(String(assignment.pc_org_id ?? "")) ??
      assignment.pc_org_id;

    rows.push({
      person_id: String(assignment.person_id ?? ""),
      tech_id: techId,
      full_name: person?.full_name ?? "Unknown",
      context: orgLabel ?? "",
      metrics,
      below_target_count: belowTargetCount,
    });
  }

  return rows;
}