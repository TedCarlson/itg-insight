import { buildKpiValue } from "@/shared/kpis/buildKpiPayload";
import { resolveKpiPresentation } from "@/shared/kpis/core/presentation";

import type {
  KpiDefinitionLike,
  RawMetricPayload,
} from "@/shared/kpis/contracts/kpiTypes";

import type { BpSupervisorKpiItem } from "../components/BpSupervisorKpiStrip";

type RubricRow = {
  band_key: "EXCEEDS" | "MEETS" | "NEEDS_IMPROVEMENT" | "MISSES" | "NO_DATA";
  min_value: number | null;
  max_value: number | null;
};

type Args = {
  definitions: KpiDefinitionLike[];
  rows: RawMetricPayload[];
  bands_by_kpi?: Record<string, RubricRow[]>;
  context: {
    is_totals_row: boolean;
    is_single_row: boolean;
    is_single_fm: boolean;
  };
  support?: string;
  limit?: number;
};

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_%]/g, "");
}

function getRubric(
  def: KpiDefinitionLike,
  map?: Record<string, RubricRow[]>
): RubricRow[] {
  if (!map) return [];

  const keys = [
    def.kpi_key,
    def.raw_label_identifier,
    def.customer_label,
    def.label,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  for (const key of keys) {
    if (map[key]?.length) return map[key];
  }

  const normalized = keys.map(normalize);

  for (const [key, rubric] of Object.entries(map)) {
    if (normalized.includes(normalize(key))) {
      return rubric;
    }
  }

  return [];
}

function toItem(args: {
  def: KpiDefinitionLike;
  rows: RawMetricPayload[];
  bands?: Record<string, RubricRow[]>;
  context: Args["context"];
  support: string;
}): BpSupervisorKpiItem {
  const value = buildKpiValue({
    def: args.def,
    rows: args.rows,
    context: args.context,
  });

  const rubric = getRubric(args.def, args.bands);

  const presentation = resolveKpiPresentation({
    kpiKey: args.def.kpi_key,
    value,
    rubric,
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

export function buildBpSupervisorKpiStripPayload(
  args: Args
): BpSupervisorKpiItem[] {
  const support = args.support ?? `${args.rows.length} row(s) in scope`;

  const defs =
    typeof args.limit === "number"
      ? args.definitions.slice(0, args.limit)
      : args.definitions;

  return defs.map((def) =>
    toItem({
      def,
      rows: args.rows,
      bands: args.bands_by_kpi,
      context: args.context,
      support,
    })
  );
}