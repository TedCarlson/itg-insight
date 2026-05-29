// path: apps/web/src/app/(app)/bp-supervisor/page.tsx

import BpSupervisorMetricsPageShell from "@/features/role-bp-supervisor/pages/BpSupervisorMetricsPageShell";

export default async function Page() {
  return (
    <BpSupervisorMetricsPageShell
      class_type="NSR"
      range="FM"
    />
  );
}
