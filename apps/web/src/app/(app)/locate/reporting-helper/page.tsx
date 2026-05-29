import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { LocateReportingNav } from "@/features/locate/reporting-helper/LocateReportingNav";
import { ReportingHelperClient } from "@/features/locate/reporting-helper/ReportingHelperClient";

export default function ReportingHelperPage() {
  return (
    <PageShell>
      <LocateReportingNav />

      <PageHeader
        title="Reporting Helper"
        subtitle="One paste. One click. One polished Locate report."
      />
      <ReportingHelperClient />
    </PageShell>
  );
}
