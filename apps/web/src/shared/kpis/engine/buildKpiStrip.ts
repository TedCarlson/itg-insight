import { buildKpiValue } from "@/shared/kpis/buildKpiPayload";
import { resolveKpiPresentation } from "@/shared/kpis/core/presentation";
import type {
  KpiDefinitionLike,
  RawMetricPayload,
} from "@/shared/kpis/contracts/kpiTypes";

export type BuiltKpiStripItem = {
  kpi_key: string;
  label: string;
  value: number | null;
  value_display: string;
  band_key: string;
  band_label: string;
  support?: string;
};

type RubricRow = {
  band_key: "EXCEEDS" | "MEETS" | "NEEDS_IMPROVEMENT" | "MISSES" | "NO_DATA";
  min_value: number | null;
  max_value: number | null;
};

type OrderedKpiDefinition = KpiDefinitionLike & {
  sort_order?: number | null;
};

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_%]/g, "");
}

function getRubricForKpi(args: {
  def: KpiDefinitionLike;
  rubricByKpi: Map<string, RubricRow[]>;
}): RubricRow[] {
  const direct = args.rubricByKpi.get(args.def.kpi_key);
  if (direct && direct.length > 0) {
    return direct;
  }

  const candidateKeys = [
    args.def.raw_label_identifier,
    args.def.customer_label,
    args.def.label,
    args.def.kpi_key,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  const normalizedCandidates = candidateKeys.map(normalizeToken);

  for (const [key, rubric] of args.rubricByKpi.entries()) {
    if (normalizedCandidates.includes(normalizeToken(key))) {
      return rubric;
    }
  }

  return [];
}

function toStripItem(args: {
  def: KpiDefinitionLike;
  rows: RawMetricPayload[];
  rubricByKpi: Map<string, RubricRow[]>;
  context: {
    is_totals_row: boolean;
    is_single_row: boolean;
    is_single_fm: boolean;
  };
  support: string;
}): BuiltKpiStripItem {
  const value = buildKpiValue({
    def: args.def,
    rows: args.rows,
    context: args.context,
  });

  const presentation = resolveKpiPresentation({
    kpiKey: args.def.kpi_key,
    value,
    rubric: getRubricForKpi({
      def: args.def,
      rubricByKpi: args.rubricByKpi,
    }),
  });

  return {
    kpi_key: args.def.kpi_key,
    label:
      String(args.def.customer_label ?? "").trim() ||
      String(args.def.label ?? "").trim() ||
      presentation.label,
    value: presentation.value,
    value_display: presentation.value_display ?? "—",
    band_key: presentation.band_key,
    band_label: presentation.band_label,
    support: args.support,
  };
}

export function buildKpiStrip(args: {
  definitions: OrderedKpiDefinition[];
  rows: RawMetricPayload[];
  rubricByKpi: Map<string, RubricRow[]>;
  context: {
    is_totals_row: boolean;
    is_single_row: boolean;
    is_single_fm: boolean;
  };
  support?: string;
}): BuiltKpiStripItem[] {
  const support = args.support ?? `${args.rows.length} row(s) in scope`;

  return args.definitions.map((def) =>
    toStripItem({
      def,
      rows: args.rows,
      rubricByKpi: args.rubricByKpi,
      context: args.context,
      support,
    })
  );
}   