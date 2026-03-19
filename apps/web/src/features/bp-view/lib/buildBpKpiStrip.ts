import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";
import type { BpViewKpiItem, BpViewRosterRow } from "./bpView.types";
import { bandLabel, formatValueDisplay, pickBand } from "./bpViewMetricHelpers";

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

export function buildBpKpiStrip(args: {
  rosterRows: BpViewRosterRow[];
  kpis: KpiCfg[];
  rubricByKpi: Map<string, RubricRow[]>;
}): BpViewKpiItem[] {
  return args.kpis.map((kpi) => {
    const values = args.rosterRows
      .map((row) => row.metrics.find((m) => m.kpi_key === kpi.kpi_key)?.value ?? null)
      .filter((v): v is number => v != null);

    const avg =
      values.length > 0
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : null;

    const band_key = pickBand(avg, args.rubricByKpi.get(kpi.kpi_key));

    return {
      kpi_key: kpi.kpi_key,
      label: kpi.label,
      value: avg,
      value_display: formatValueDisplay(kpi.kpi_key, avg),
      band_key,
      band_label: bandLabel(band_key),
      support: `${args.rosterRows.length} techs in scope`,
    };
  });
}