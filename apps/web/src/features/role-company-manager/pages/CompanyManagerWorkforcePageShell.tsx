// path: apps/web/src/features/role-company-manager/pages/CompanyManagerWorkforcePageShell.tsx

import { Card } from "@/components/ui/Card";
import { WorkforceSurfaceClient } from "@/shared/surfaces/workforce/WorkforceSurfaceClient";
import { getCompanyManagerWorkforceSurfacePayload } from "../lib/getCompanyManagerWorkforceSurfacePayload.server";

type WorkforceStatus = "ACTIVE" | "INACTIVE" | "ALL";

type Props = {
  selected_person_id?: string;
  search?: string;
  reports_to_person_id?: string;
  status?: WorkforceStatus;
  as_of_date?: string;
};

export default async function CompanyManagerWorkforcePageShell(props: Props) {
  const payload = await getCompanyManagerWorkforceSurfacePayload({
    as_of_date: props.as_of_date ?? null,
  });

  return (
    <div className="space-y-4 p-4">
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Workforce
            </div>

            <div className="mt-1 text-2xl font-semibold tracking-tight">
              Workforce Overview
            </div>

            <div className="mt-2 text-sm text-muted-foreground">
              {payload.summary.total} seats • {payload.summary.field} field •{" "}
              {payload.summary.leadership} leadership •{" "}
              {payload.summary.incomplete} incomplete
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {payload.tabs.map((tab) => (
              <div key={tab.key} className="rounded-xl border bg-card px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {tab.label}
                </div>
                <div className="mt-1 text-xl font-semibold leading-none">
                  {tab.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <WorkforceSurfaceClient payload={payload} mode="manager" />
    </div>
  );
}