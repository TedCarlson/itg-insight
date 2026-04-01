import CompanyManagerHeader from "../components/CompanyManagerHeader";
import CompanyManagerKpiStrip from "../components/CompanyManagerKpiStrip";
import CompanyManagerRiskStrip from "../components/CompanyManagerRiskStrip";
import CompanyManagerControlBar from "../components/CompanyManagerControlBar";
import CompanyManagerRosterTable from "../components/CompanyManagerRosterTable";
import CompanyManagerOfficeTable from "../components/CompanyManagerOfficeTable";
import CompanyManagerLeadershipTable from "../components/CompanyManagerLeadershipTable";
import { getCompanyManagerViewPayload } from "../lib/getCompanyManagerViewPayload.server";
import type { RangeKey } from "@/shared/kpis/engine/resolveKpiOverrides";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";

type Props = {
  range: RangeKey;
};

export default async function CompanyManagerPageShell(props: Props) {
  const payload = await getCompanyManagerViewPayload({
    range: props.range,
  });

  return (
    <div className="p-4 space-y-4">
      <CompanyManagerHeader header={payload.header} />
      <CompanyManagerKpiStrip items={payload.kpi_strip} />
      <CompanyManagerRiskStrip items={payload.risk_strip} />
      <CompanyManagerControlBar
        activeMode={payload.active_mode}
        activeSegment={payload.active_segment}
      />

      {payload.active_mode === "WORKFORCE" ? (
        <CompanyManagerRosterTable
          columns={payload.roster_columns}
          rows={payload.roster_rows}
          rubricByKpi={payload.rubricByKpi}
          work_mix={payload.work_mix}
          parityRows={payload.parityRows}
          active_range={props.range as MetricsRangeKey}
        />
      ) : null}

      {payload.active_mode === "OFFICE" ? (
        <CompanyManagerOfficeTable rows={payload.office_rows} />
      ) : null}

      {payload.active_mode === "LEADERSHIP" ? (
        <CompanyManagerLeadershipTable rows={payload.leadership_rows} />
      ) : null}
    </div>
  );
}