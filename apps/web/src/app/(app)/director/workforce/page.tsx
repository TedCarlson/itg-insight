// path: apps/web/src/app/(app)/director/workforce/page.tsx

import DirectorWorkforcePageShell from "@/features/role-director/pages/DirectorWorkforcePageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DirectorWorkforcePage() {
  return <DirectorWorkforcePageShell />;
}