import { redirect } from "next/navigation";

import { buildHomeSurfacePayload } from "@/shared/home/server/buildHomeSurfacePayload.server";
import { HomeSurface } from "@/shared/home/surfaces/HomeSurface";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const payload = await buildHomeSurfacePayload();

  if (payload.context.role === "DIRECTOR") {
    redirect("/director/executive");
  }

  if (payload.context.role === "BP_OWNER") {
    redirect("/bp-owner");
  }

  return <HomeSurface payload={payload} />;
}
