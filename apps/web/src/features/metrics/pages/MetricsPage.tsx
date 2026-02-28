import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MetricsPage() {
  // One-button arrival from core nav.
  redirect("/metrics/reports");
}