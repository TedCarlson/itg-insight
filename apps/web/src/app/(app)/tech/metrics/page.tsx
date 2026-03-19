import { redirect } from "next/navigation";

import TechMetricsFeaturePage from "@/features/tech/metrics/page";
import { getHomePayload } from "@/features/home/lib/getHomePayload.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page(props: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const home = await getHomePayload();

  if (home.role !== "TECH") {
    redirect("/home");
  }

  return <TechMetricsFeaturePage searchParams={props.searchParams} />;
}