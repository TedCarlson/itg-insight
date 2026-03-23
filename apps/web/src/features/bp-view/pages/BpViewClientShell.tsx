"use client";

import { useState } from "react";

import type {
  BpRangeKey,
  BpViewPayload,
  BpViewRosterRow,
} from "../lib/bpView.types";

import BpViewHeader from "../components/BpViewHeader";
import BpViewKpiStrip from "../components/BpViewKpiStrip";
import BpViewRiskStrip from "../components/BpViewRiskStrip";
import BpWorkMixCard from "../components/BpWorkMixCard";
import BpViewRosterSurface from "../components/BpViewRosterSurface";
import BpTechDrillDrawer from "../components/BpTechDrillDrawer";

export default function BpViewClientShell(props: {
  payload: BpViewPayload;
  initialRange: BpRangeKey;
}) {
  const { payload, initialRange } = props;
  const [selectedRow, setSelectedRow] = useState<BpViewRosterRow | null>(null);

  return (
    <div className="space-y-6">
      <BpViewHeader header={payload.header} />

      <div className="space-y-6">
        <BpViewKpiStrip items={payload.kpi_strip} />
        <BpWorkMixCard workMix={payload.work_mix} />
        <BpViewRiskStrip items={payload.risk_strip} />
        <BpViewRosterSurface
          columns={payload.roster_columns}
          rows={payload.roster_rows}
          onSelectRow={setSelectedRow}
        />
      </div>

      <BpTechDrillDrawer
        open={!!selectedRow}
        row={selectedRow}
        range={initialRange}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}