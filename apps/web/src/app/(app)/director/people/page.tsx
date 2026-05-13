// path: apps/web/src/app/(app)/director/people/page.tsx

import DirectorPeoplePageShell from "@/features/role-director/pages/DirectorPeoplePageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DirectorPeoplePage() {
  return <DirectorPeoplePageShell />;
}