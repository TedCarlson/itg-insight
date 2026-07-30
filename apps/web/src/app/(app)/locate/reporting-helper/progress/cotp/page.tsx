import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { LocateReportingNav } from "@/features/locate/reporting-helper/LocateReportingNav";
import { CotpProgressClient } from "@/features/locate/reporting-helper/CotpProgressClient";

export default function CotpProgressPage() {
  return (
    <PageShell>
      <LocateReportingNav />
      <PageHeader
        title="COTP Day by Day"
        subtitle="Select a date range and review each day&apos;s latest week-end actual by state."
      />
      <CotpProgressClient />
    </PageShell>
  );
}
