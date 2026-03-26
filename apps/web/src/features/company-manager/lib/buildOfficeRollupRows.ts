import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";
import type { BpViewRosterRow } from "@/features/bp-view/lib/bpView.types";
import { bandLabel, formatValueDisplay, pickBand } from "@/features/bp-view/lib/bpViewMetricHelpers";

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

export type OfficeRollupRow = {
  office: string;
  metrics: {
    kpi_key: string;
    label: string;
    value: number | null;
    value_display: string | null;
    band_key: BandKey;
    band_label: string;
  }[];
  hc: number;
};

function getRowWeight(row: BpViewRosterRow): number {
  const wm = row.work_mix;
  if (!wm) return 0;

  const total =
    (wm.installs ?? 0) +
    (wm.tcs ?? 0) +
    (wm.sros ?? 0);

  return total > 0 ? total : 0;
}

export function buildOfficeRollupRows(args: {
  rosterRows: BpViewRosterRow[];
  kpis: KpiCfg[];
  rubricByKpi: Map<string, RubricRow[]>;
  officeByTech: Map<string, string>;
}): OfficeRollupRow[] {
  const grouped = new Map<string, BpViewRosterRow[]>();

  for (const row of args.rosterRows) {
    const office =
      args.officeByTech.get(row.tech_id) ??
      "Unknown";

    const arr = grouped.get(office) ?? [];
    arr.push(row);
    grouped.set(office, arr);
  }

  const out: OfficeRollupRow[] = [];

  for (const [office, rows] of grouped.entries()) {
    const metrics = args.kpis.map((kpi) => {
      let weightedSum = 0;
      let totalWeight = 0;

      for (const row of rows) {
        const metric = row.metrics.find(
          (m) => m.kpi_key === kpi.kpi_key
        );

        const value = metric?.value ?? null;
        if (value == null || !Number.isFinite(value)) continue;

        const weight = getRowWeight(row);
        if (weight <= 0) continue;

        weightedSum += value * weight;
        totalWeight += weight;
      }

      const value =
        totalWeight > 0 ? weightedSum / totalWeight : null;

      const band_key = pickBand(value, args.rubricByKpi.get(kpi.kpi_key));

      return {
        kpi_key: kpi.kpi_key,
        label: kpi.label,
        value,
        value_display: formatValueDisplay(kpi.kpi_key, value),
        band_key,
        band_label: bandLabel(band_key),
      };
    });

    out.push({
      office,
      metrics,
      hc: rows.length,
    });
  }

  return out.sort((a, b) => a.office.localeCompare(b.office));
}