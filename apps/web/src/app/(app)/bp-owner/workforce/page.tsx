// path: apps/web/src/app/(app)/bp-owner/workforce/page.tsx

import { Card } from "@/components/ui/Card";
import { PageHeader, PageShell } from "@/components/ui/PageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <PageShell>
      <PageHeader
        title="BP Owner Workforce"
        subtitle="Contractor-scoped workforce, staffing composition, and future schedule reports."
      />

      <div id="shell-role-hint" data-shell-role="BP_OWNER" className="hidden" />

      <Card className="p-5">
        <div className="text-sm font-semibold">Coming next</div>
        <p className="mt-2 text-sm text-muted-foreground">
          This surface will show active workforce by org, supervisor grouping,
          and read-only schedule reports.
        </p>
      </Card>
    </PageShell>
  );
}