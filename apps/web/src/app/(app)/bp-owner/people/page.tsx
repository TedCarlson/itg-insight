// path: apps/web/src/app/(app)/bp-owner/people/page.tsx

import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <PageShell>
      <PageHeader
        title="BP Owner People"
        subtitle="People tied to your business partner affiliation."
      />

      <div id="shell-role-hint" data-shell-role="BP_OWNER" className="hidden" />

      <Card className="p-5">
        <div className="text-sm font-semibold">Coming next</div>
        <p className="mt-2 text-sm text-muted-foreground">
          This surface will show people records scoped to the BP Owner contractor relationship.
        </p>
      </Card>
    </PageShell>
  );
}