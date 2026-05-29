import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { LocateReportingNav } from "@/features/locate/reporting-helper/LocateReportingNav";

export default function LocateReportingPage() {
  return (
    <PageShell>
      <LocateReportingNav />

      <PageHeader
        title="Reporting"
        subtitle="Locate reporting workspace for helper tools, history, and progress tracking."
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <div className="text-base font-semibold">Reporting Helper</div>
          <p className="mt-2 text-sm text-[var(--to-ink-muted)]">
            Paste messy operational updates and generate a leadership-ready COTP report.
          </p>
          <Link
            href="/locate/reporting-helper"
            className="mt-4 inline-flex rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
          >
            Open Helper
          </Link>
        </Card>

        <Card>
          <div className="text-base font-semibold">Reporting History</div>
          <p className="mt-2 text-sm text-[var(--to-ink-muted)]">
            Review saved canonical reporting records and export prior reports.
          </p>
          <Link
            href="/locate/reporting-helper/history"
            className="mt-4 inline-flex rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
          >
            Open History
          </Link>
        </Card>

        <Card>
          <div className="text-base font-semibold">Reports</div>
          <p className="mt-2 text-sm text-[var(--to-ink-muted)]">
            Track COTP progress over time with trends, slices, and reporting intelligence.
          </p>
          <Link
            href="/locate/reporting-helper/progress/cotp"
            className="mt-4 inline-flex rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
          >
            Open COTP Progress
          </Link>
        </Card>
      </div>
    </PageShell>
  );
}
