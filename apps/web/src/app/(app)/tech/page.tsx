import { redirect } from "next/navigation";

import TechHomePage from "@/features/tech/home/page";
import { getHomePayload } from "@/features/home/lib/getHomePayload.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const home = await getHomePayload();

  if (home.role !== "TECH") {
    redirect("/home");
  }

  return <TechHomePage />;
}