import { unstable_noStore as noStore } from "next/cache";

import CompanyManagerPageShell from "@/features/role-company-manager/pages/CompanyManagerPageShell";

type Props = {
  searchParams: Promise<{
    range?: "FM" | "PREVIOUS" | "3FM" | "12FM";
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Route(props: Props) {
  noStore();

  const sp = await props.searchParams;
  const range = sp?.range ?? "FM";

  return <CompanyManagerPageShell range={range} />;
}