// RUN THIS
// path: apps/web/src/app/(app)/bp-owner/metrics/page.tsx

import BpOwnerMetricsPageShell from "@/features/role-bp-owner/pages/BpOwnerMetricsPageShell";

type PageProps = {
  searchParams?: Promise<{
    range?: string;
    class_type?: string;
  }>;
};

function normalizeClassType(value: string | undefined): "NSR" | "SMART" {
  return String(value ?? "NSR").trim().toUpperCase() === "SMART"
    ? "SMART"
    : "NSR";
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;

  const class_type = normalizeClassType(searchParams?.class_type);
  const range = searchParams?.range;

  return (
    <BpOwnerMetricsPageShell
      class_type={class_type}
      range={range}
    />
  );
}