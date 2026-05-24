// path: apps/web/src/app/(app)/metrics/loading.tsx

import { InsightLoadingState } from "@/shared/ui/loading/InsightLoadingState";

export default function Loading() {
  return (
    <InsightLoadingState
      title="Loading Metrics Intelligence..."
      description="Building the latest performance snapshot."
    />
  );
}