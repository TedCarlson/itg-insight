import { redirect } from "next/navigation";

import BpViewPageShell from "@/features/bp-view/pages/BpViewPageShell";
import { getHomePayload } from "@/features/home/lib/getHomePayload.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const home = await getHomePayload();

  const isBpRole =
    home.role === "BP_SUPERVISOR" || home.role === "BP_OWNER";

  if (!isBpRole) {
    redirect("/home");
  }

  return <BpViewPageShell />;
}