import type {
  KpiDefinitionLike,
  RawMetricPayload,
} from "@/shared/kpis/contracts/kpiTypes";
import { aggregateResolvedValues } from "@/shared/kpis/math/aggregateResolvedValues";
import { resolveRawValue } from "@/shared/kpis/math/resolveRawValue";

type BuildArgs = {
  def: KpiDefinitionLike;
  rows: RawMetricPayload[];
  context: {
    is_totals_row: boolean;
    is_single_row: boolean;
    is_single_fm: boolean;
  };
};

function shouldCopyKpi(args: BuildArgs["context"]): boolean {
  if (args.is_totals_row) {
    return true;
  }

  if (args.is_single_row && args.is_single_fm) {
    return true;
  }

  return false;
}

/**
 * Central KPI resolution rule:
 *
 * 1. totals row             -> copy direct KPI
 * 2. single row + single FM -> copy direct KPI
 * 3. anything else          -> compute from supporting facts
 *
 * NEVER average.
 */
export function buildKpiValue(args: BuildArgs): number | null {
  if (!args.rows.length) {
    return null;
  }

  if (shouldCopyKpi(args.context)) {
    return resolveRawValue({
      def: args.def,
      raw: args.rows[0],
    });
  }

  return aggregateResolvedValues({
    def: args.def,
    rows: args.rows,
  });
}