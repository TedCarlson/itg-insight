import BpViewHeader from "../components/BpViewHeader";
import BpViewKpiStrip from "../components/BpViewKpiStrip";
import BpViewRiskStrip from "../components/BpViewRiskStrip";
import BpViewRosterSurface from "../components/BpViewRosterSurface";
import { getBpViewPayload } from "../lib/getBpViewPayload.server";

export default async function BpViewPageShell() {
  const payload = await getBpViewPayload({ range: "FM" });

  return (
    <div className="space-y-4">
      <BpViewHeader header={payload.header} />
      <BpViewKpiStrip items={payload.kpi_strip} />
      <BpViewRiskStrip items={payload.risk_strip} />
      <BpViewRosterSurface
        columns={payload.roster_columns}
        rows={payload.roster_rows}
      />
    </div>
  );
}