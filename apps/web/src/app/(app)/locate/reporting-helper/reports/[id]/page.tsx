import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { LocateReportingNav } from "@/features/locate/reporting-helper/LocateReportingNav";
import { ReportingHelperReportClient } from "@/features/locate/reporting-helper/ReportingHelperReportClient";

export default async function SavedReportingHelperReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageShell>
      <LocateReportingNav />

      <PageHeader
        title="Saved Report"
        subtitle="Canonical saved Locate reporting record."
      />
      <ReportingHelperReportClient recordId={id} />
    </PageShell>
  );
}
