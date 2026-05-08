// path: apps/web/src/app/(app)/director/route-lock/page.tsx

import DirectorRouteLockPageShell from "@/features/role-director/pages/DirectorRouteLockPageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DirectorRouteLockPage() {
  return <DirectorRouteLockPageShell />;
}