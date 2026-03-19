import { redirect } from "next/navigation";

import { FieldLogRuntimeProvider } from "@/features/field-log/context/FieldLogRuntimeProvider";
import { FieldLogRuntimeGate } from "@/features/field-log/components/FieldLogRuntimeGate";
import FieldLogNewClient from "@/features/field-log/pages/FieldLogNewClient";
import { getHomePayload } from "@/features/home/lib/getHomePayload.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TechFieldLogNewPage() {
  const home = await getHomePayload();

  if (home.role !== "TECH") {
    redirect("/home");
  }

  return (
    <FieldLogRuntimeProvider>
      <FieldLogRuntimeGate>
        <FieldLogNewClient />
      </FieldLogRuntimeGate>
    </FieldLogRuntimeProvider>
  );
}