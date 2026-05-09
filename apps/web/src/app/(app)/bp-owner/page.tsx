// path: apps/web/src/app/(app)/bp-owner/page.tsx

import BpOwnerOverviewPageShell from "@/features/role-bp-owner/pages/BpOwnerOverviewPageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return <BpOwnerOverviewPageShell />;
}