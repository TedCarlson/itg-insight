import { resolveKpiPresentation } from "@/shared/kpis/core/presentation";
import { aggregateMetricFactsForKpi } from "@/shared/kpis/engine/aggregateMetricFactsForKpi";

import type {
  KpiDefinitionLike,
  RawMetricPayload,
} from "@/shared/kpis/contracts/kpiTypes";
import type { LoadedKpiConfigItem } from "@/shared/kpis/engine/loadKpiConfig.server";
import type { LoadedKpiRubricRow } from "@/shared/kpis/engine/loadKpiRubric.server";

import type { CompanySupervisorKpiItem } from "../components/CompanySupervisorKpiStrip";

type Args = {
  definitions: LoadedKpiConfigItem[];
  supervisorFacts: RawMetricPayload[];
  orgFacts: RawMetricPayload[];
  rubricByKpi: Map<string, LoadedKpiRubricRow[]>;
  support?: string | null;
  comparison_scope_code: string;
};

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_%]/g, "");
}

function getRubric(
  def: KpiDefinitionLike,
  map: Map<string, LoadedKpiRubricRow[]>
): LoadedKpiRubricRow[] {
  const direct = map.get(def.kpi_key);
  if (direct?.length) return direct;

  const candidates = [
    def.kpi_key,
    def.raw_label_identifier,
    def.customer_label,
    def.label,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .map(normalize);

  for (const [key, rows] of map.entries()) {
    if (candidates.includes(normalize(key))) {
      return rows;
    }
  }

  return [];
}

function formatComparisonValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function formatDelta(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs >= 10 ? abs.toFixed(1) : abs.toFixed(2);
  return `${value > 0 ? "+" : "-"}${formatted}`;
}

function resolveComparison(args: {
  scopeValue: number | null;
  orgValue: number | null;
  direction: string | null;
  comparison_scope_code: string;
}) {
  const scopeCode = String(args.comparison_scope_code ?? "").trim() || "ORG";

  if (
    args.scopeValue == null ||
    !Number.isFinite(args.scopeValue) ||
    args.orgValue == null ||
    !Number.isFinite(args.orgValue)
  ) {
    return {
      comparison_value_display: "—",
      variance_display: null,
      comparison_scope_code: scopeCode,
      comparison_state: "neutral" as const,
    };
  }

  const delta = args.scopeValue - args.orgValue;

  if (Math.abs(delta) < 0.000001) {
    return {
      comparison_value_display: formatComparisonValue(args.orgValue),
      variance_display: "0.0",
      comparison_scope_code: scopeCode,
      comparison_state: "neutral" as const,
    };
  }

  const direction = String(args.direction ?? "").trim().toUpperCase();
  const better = direction === "LOWER_BETTER" ? delta < 0 : delta > 0;

  return {
    comparison_value_display: formatComparisonValue(args.orgValue),
    variance_display: formatDelta(delta),
    comparison_scope_code: scopeCode,
    comparison_state: better ? ("better" as const) : ("worse" as const),
  };
}

function toItem(args: {
  def: LoadedKpiConfigItem;
  supervisorFacts: RawMetricPayload[];
  orgFacts: RawMetricPayload[];
  rubricByKpi: Map<string, LoadedKpiRubricRow[]>;
  support: string | null;
  comparison_scope_code: string;
}): CompanySupervisorKpiItem {
  const scopeValue = aggregateMetricFactsForKpi({
    def: args.def,
    rows: args.supervisorFacts,
  });

  const orgValue = aggregateMetricFactsForKpi({
    def: args.def,
    rows: args.orgFacts,
  });

  const presentation = resolveKpiPresentation({
    kpiKey: args.def.kpi_key,
    value: scopeValue,
    rubric: getRubric(args.def, args.rubricByKpi),
  });

  const comparison = resolveComparison({
    scopeValue,
    orgValue,
    direction: args.def.direction,
    comparison_scope_code: args.comparison_scope_code,
  });

  return {
    kpi_key: args.def.kpi_key,
    label:
      String(args.def.customer_label ?? "").trim() ||
      String(args.def.label ?? "").trim() ||
      presentation.label,
    value_display: presentation.value_display ?? "—",
    band_key: presentation.band_key,
    band_label: presentation.band_label,
    support: args.support,
    comparison_scope_code: comparison.comparison_scope_code,
    comparison_value_display: comparison.comparison_value_display,
    variance_display: comparison.variance_display,
    comparison_state: comparison.comparison_state,
  };
}

export function buildCompanySupervisorKpiStripPayload(
  args: Args
): CompanySupervisorKpiItem[] {
  const support = args.support ?? null;

  return args.definitions.map((def) =>
    toItem({
      def,
      supervisorFacts: args.supervisorFacts,
      orgFacts: args.orgFacts,
      rubricByKpi: args.rubricByKpi,
      support,
      comparison_scope_code: args.comparison_scope_code,
    })
  );
}