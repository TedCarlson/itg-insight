import { getHomePayload } from "../lib/getHomePayload.server";
import { getWidgetPayload } from "../lib/getWidgetPayload.server";

import HomeHeader from "../components/HomeHeader";
import HomeDestinations from "../components/HomeDestinations";
import ITGSupervisorHomeWorkspace from "../components/ITGSupervisorHomeWorkspace";
import ManagerHomeWorkspace from "../components/ManagerHomeWorkspace";

export default async function HomePageShell() {
  const payload = await getHomePayload();

  const isItgSupervisor = payload.role === "ITG_SUPERVISOR";
  const isCompanyManager = payload.role === "COMPANY_MANAGER";

  const widgetPayload =
    isCompanyManager
      ? await getWidgetPayload({
          role: payload.role,
          selectedPcOrgId: payload.has_selected_org
            ? payload.selected_pc_org_id ?? null
            : null,
        })
      : null;

  return (
    <div className="space-y-4">
      <div
        id="shell-role-hint"
        data-shell-role={payload.role}
        className="hidden"
        aria-hidden="true"
      />

      {isItgSupervisor ? (
        <ITGSupervisorHomeWorkspace payload={payload} />
      ) : isCompanyManager && widgetPayload ? (
        <ManagerHomeWorkspace payload={payload} widgetPayload={widgetPayload} />
      ) : (
        <>
          <HomeHeader payload={payload} />
          <HomeDestinations payload={payload} />
        </>
      )}
    </div>
  );
}