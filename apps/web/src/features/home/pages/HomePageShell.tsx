// path: apps/web/src/features/home/pages/HomePageShell.tsx

import { redirect } from "next/navigation";

import { getHomePayload } from "../lib/getHomePayload.server";
import { getWidgetPayload } from "../lib/getWidgetPayload.server";

import HomeHeader from "../components/HomeHeader";
import HomeDestinations from "../components/HomeDestinations";
import ITGSupervisorHomeWorkspace from "../components/ITGSupervisorHomeWorkspace";
import ManagerHomeWorkspace from "../components/ManagerHomeWorkspace";

export default async function HomePageShell() {
  const payload = await getHomePayload();

  if (payload.role === "DIRECTOR") {
    redirect("/director/workspace");
  }

  if (payload.role === "BP_OWNER") {
    redirect("/bp-owner");
  }

  const isItgSupervisor = payload.role === "ITG_SUPERVISOR";
  const isCompanyManager = payload.role === "COMPANY_MANAGER";

  const usesWorkspace = isItgSupervisor || isCompanyManager;

  const widgetPayload = usesWorkspace
    ? await getWidgetPayload()
    : null;

  return (
    <div className="space-y-4">
      <div
        id="shell-role-hint"
        data-shell-role={payload.role}
        className="hidden"
        aria-hidden="true"
      />

      {isItgSupervisor && widgetPayload ? (
        <ITGSupervisorHomeWorkspace
          payload={payload}
          widgetPayload={widgetPayload}
        />
      ) : isCompanyManager && widgetPayload ? (
        <ManagerHomeWorkspace
          payload={payload}
          widgetPayload={widgetPayload}
        />
      ) : (
        <>
          <HomeHeader payload={payload} />
          <HomeDestinations payload={payload} />
        </>
      )}
    </div>
  );
}