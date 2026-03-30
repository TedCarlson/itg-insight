import BpSupervisorKpiStrip, {
  BpSupervisorKpiItem,
} from "../components/BpSupervisorKpiStrip";

import { buildBpSupervisorKpiStripPayload } from "../lib/buildBpSupervisorKpiStripPayload";

import type {
  KpiDefinitionLike,
  RawMetricPayload,
} from "@/shared/kpis/contracts/kpiTypes";

import type { KpiBandDefinition } from "@/shared/kpis/math/resolveBand";

type Props = {
  definitions: KpiDefinitionLike[];
  rows: RawMetricPayload[];
  bands_by_kpi?: Record<string, KpiBandDefinition[]>;
  context: {
    is_totals_row: boolean;
    is_single_row: boolean;
    is_single_fm: boolean;
  };
  support?: string;
};

export default function BpSupervisorHomePageShell(props: Props) {
  const items: BpSupervisorKpiItem[] = buildBpSupervisorKpiStripPayload({
    definitions: props.definitions,
    rows: props.rows,
    bands_by_kpi: props.bands_by_kpi,
    context: props.context,
    support: props.support,
  });

  return (
    <div className="space-y-4">
      <BpSupervisorKpiStrip items={items} />

      <pre className="rounded-xl border bg-card p-3 text-xs">
        {JSON.stringify(
          {
            definitions_count: props.definitions.length,
            items_count: items.length,
            first_item: items[0] ?? null,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}