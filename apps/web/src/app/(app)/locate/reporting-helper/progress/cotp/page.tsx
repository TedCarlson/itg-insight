import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { LocateReportingNav } from "@/features/locate/reporting-helper/LocateReportingNav";
import { CotpProgressClient } from "@/features/locate/reporting-helper/CotpProgressClient";

export default function CotpProgressPage() {
  return (
    <PageShell>
      <LocateReportingNav />

      <PageHeader
        title="COTP Progress"
        subtitle="Canonical operational progress and trend intelligence."
      />

      <CotpProgressClient />
    </PageShell>
  );
}
