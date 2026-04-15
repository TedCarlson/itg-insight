// path: apps/web/src/app/(app)/company-manager/page.tsx

import CompanyManagerPageShell from "@/features/role-company-manager/pages/CompanyManagerPageShell";

type PageProps = {
  searchParams?: Promise<{
    range?: string;
    class_type?: string;
  }>;
};

function normalizeClassType(value: string | undefined): "NSR" | "SMART" {
  return value === "NSR" ? "NSR" : "SMART";
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  const class_type = normalizeClassType(searchParams?.class_type);
  const range = searchParams?.range;

  return (
    <CompanyManagerPageShell
      class_type={class_type}
      range={range}
    />
  );
}