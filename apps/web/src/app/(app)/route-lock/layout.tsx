import type { ReactNode } from "react";

import { PageShell, PageHeader } from "@/components/ui/PageShell";
import RouteLockSubnav from "@/features/route-lock/components/RouteLockSubnav";

export default function RouteLockLayout(props: { children: ReactNode }) {
  return (
    <PageShell>
      <PageHeader
        title="Route Lock"
        subtitle="Configure schedule, quotas, routes, shift-validation, and check-in."
      />
      <RouteLockSubnav />
      <div className="mt-4">{props.children}</div>
    </PageShell>
  );
}