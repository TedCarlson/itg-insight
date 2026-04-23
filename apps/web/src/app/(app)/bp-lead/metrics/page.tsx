// path: apps/web/src/app/(app)/bp-lead/metrics/page.tsx

import BpLeadMetricsPageShell from "@/features/role-bp-lead/pages/BpLeadMetricsPageShell";

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
    <BpLeadMetricsPageShell
      class_type={class_type}
      range={range}
    />
  );
}