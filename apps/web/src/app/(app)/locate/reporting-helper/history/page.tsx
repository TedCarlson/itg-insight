import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { LocateReportingNav } from "@/features/locate/reporting-helper/LocateReportingNav";
import { ReportingHelperHistoryClient } from "@/features/locate/reporting-helper/ReportingHelperHistoryClient";

export default function ReportingHelperHistoryPage() {
  return (
    <PageShell>
      <LocateReportingNav />

      <PageHeader
        title="Reporting History"
        subtitle="Review canonical saved Locate reports and export historical records."
      />
      <ReportingHelperHistoryClient />
    </PageShell>
  );
}
