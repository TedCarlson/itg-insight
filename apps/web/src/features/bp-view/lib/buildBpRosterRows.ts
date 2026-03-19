import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";
import type {
  BpViewRosterMetricCell,
  BpViewRosterRow,
} from "./bpView.types";
import { formatValueDisplay, numOrNull, pickBand } from "./bpViewMetricHelpers";
import type {
  BpScopeAssignmentRow,
  BpScopePersonRow,
} from "./resolveBpScope.server";

type KpiCfg = {
  kpi_key: string;
  label: string;
  sort: number;
};

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

function buildRosterMetricCells(args: {
  fact: FactRow | null;
  kpis: KpiCfg[];
  rubricByKpi: Map<string, RubricRow[]>;
}): BpViewRosterMetricCell[] {
  return args.kpis.map((kpi) => {
    const value = args.fact ? numOrNull(args.fact[kpi.kpi_key]) : null;
    const band_key = pickBand(value, args.rubricByKpi.get(kpi.kpi_key));

    return {
      kpi_key: kpi.kpi_key,
      label: kpi.label,
      value,
      value_display: formatValueDisplay(kpi.kpi_key, value),
      band_key,
    };
  });
}

export function buildBpRosterRows(args: {
  scopedAssignments: BpScopeAssignmentRow[];
  peopleById: Map<string, BpScopePersonRow>;
  factByTech: Map<string, FactRow>;
  kpis: KpiCfg[];
  rubricByKpi: Map<string, RubricRow[]>;
  orgLabelsById: Map<string, string>;
}): BpViewRosterRow[] {
  return args.scopedAssignments
    .map((assignment) => {
      const person_id = String(assignment.person_id ?? "");
      const tech_id = String(assignment.tech_id ?? "");
      const person = args.peopleById.get(person_id);
      const fact = args.factByTech.get(tech_id) ?? null;
      const orgLabel = args.orgLabelsById.get(String(assignment.pc_org_id ?? "")) ?? String(assignment.pc_org_id ?? "—");

      const metrics = buildRosterMetricCells({
        fact,
        kpis: args.kpis,
        rubricByKpi: args.rubricByKpi,
      });

      const below_target_count = metrics.filter(
        (m) => m.band_key === "NEEDS_IMPROVEMENT" || m.band_key === "MISSES"
      ).length;

      return {
        person_id,
        tech_id,
        full_name: person?.full_name ? String(person.full_name) : `Tech ${tech_id}`,
        context: `Tech ID ${tech_id} • ${orgLabel}`,
        metrics,
        below_target_count,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}