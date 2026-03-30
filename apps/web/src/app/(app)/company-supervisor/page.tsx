import { unstable_noStore as noStore } from "next/cache";

import CompanySupervisorPageShell from "@/features/role-company-supervisor/pages/CompanySupervisorPageShell";

type Props = {
  searchParams: Promise<{
    range?: "FM" | "3FM" | "12FM";
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Route(props: Props) {
  noStore();

  const sp = await props.searchParams;
  const range = sp?.range ?? "FM";

  return <CompanySupervisorPageShell range={range} />;
}