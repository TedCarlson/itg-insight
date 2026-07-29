// path: apps/web/src/app/(app)/director/route-lock/page.tsx

import DirectorRouteLockPageShell from "@/features/role-director/pages/DirectorRouteLockPageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DirectorRouteLockPage(props: {
  searchParams?: Promise<{ weekEnding?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const rawWeekEnding = searchParams?.weekEnding;
  const weekEnding = Array.isArray(rawWeekEnding) ? rawWeekEnding[0] : rawWeekEnding;

  return <DirectorRouteLockPageShell weekEnding={weekEnding} />;
}
