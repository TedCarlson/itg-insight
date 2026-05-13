// path: apps/web/src/app/(app)/bp-owner/tech-history/page.tsx

import TechRouteHistoryPage from "@/features/route-lock/history/pages/TechRouteHistoryPage";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <TechRouteHistoryPage
      shellRole="BP_OWNER"
      apiBasePath="/api/bp-owner/tech-history"
      searchApiBasePath="/api/bp-owner/tech-history"
    />
  );
}