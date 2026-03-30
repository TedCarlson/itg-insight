import CompanySupervisorHeader from "../components/CompanySupervisorHeader";
import CompanySupervisorKpiStrip from "../components/CompanySupervisorKpiStrip";
import CompanySupervisorRiskStrip from "../components/CompanySupervisorRiskStrip";
import CompanySupervisorRosterTable from "../components/CompanySupervisorRosterTable";
import { getCompanySupervisorViewPayload } from "../lib/getCompanySupervisorViewPayload.server";
import type { RangeKey } from "@/shared/kpis/engine/resolveKpiOverrides";

type Props = {
  range: RangeKey;
};

export default async function CompanySupervisorPageShell(props: Props) {
  const payload = await getCompanySupervisorViewPayload({
    range: props.range,
  });

  return (
    <div className="p-4 space-y-4">
      <CompanySupervisorHeader header={payload.header} />
      <CompanySupervisorKpiStrip items={payload.kpi_strip} />
      <CompanySupervisorRiskStrip items={payload.risk_strip} />
      <CompanySupervisorRosterTable
        columns={payload.roster_columns}
        rows={payload.roster_rows}
        rubricByKpi={payload.rubricByKpi}
        work_mix={payload.work_mix}
        parityRows={payload.parityRows}
      />
    </div>
  );
}