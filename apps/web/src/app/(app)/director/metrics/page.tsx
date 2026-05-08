// path: apps/web/src/app/(app)/director/metrics/page.tsx

import DirectorMetricsPageShell from "@/features/role-director/pages/DirectorMetricsPageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DirectorMetricsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    range?: string;
    class_type?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <DirectorMetricsPageShell
      range={params?.range}
      class_type={params?.class_type === "SMART" ? "SMART" : "NSR"}
    />
  );
}