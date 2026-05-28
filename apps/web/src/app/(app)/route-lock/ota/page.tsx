// path: apps/web/src/app/(app)/route-lock/ota/page.tsx

import OtaReportPage from "@/features/route-lock/ota/pages/OtaReportPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return <OtaReportPage />;
}
