import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { LocateReportingNav } from "@/features/locate/reporting-helper/LocateReportingNav";
import { LOCATE_REPORT_MODULES } from "@/shared/locate/reporting-helper/reportDefinitions";

export default function LocateReportingPage() {
  return (
    <PageShell>
      <LocateReportingNav />

      <PageHeader
        title="Reporting"
        subtitle="Select a report workflow. Each report keeps its own history, detail, and intelligence surfaces."
      />

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Locate report workflows">
        {LOCATE_REPORT_MODULES.map((report) => (
          <Card key={report.reportType}>
            <div className="flex h-full flex-col gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{report.label}</h2>
                  <span
                    className="rounded-full border px-2 py-0.5 text-xs font-medium text-[var(--to-ink-muted)]"
                    style={{ borderColor: "var(--to-border)" }}
                  >
                    Report workflow
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--to-ink-muted)]">
                  {report.description}
                </p>
              </div>

              <div className="mt-auto flex flex-wrap gap-2">
                <Link
                  href={report.workspaceHref}
                  className="to-btn inline-flex rounded-md border px-3 py-2 text-sm font-medium"
                  style={{ borderColor: "var(--to-border)" }}
                >
                  Create Report
                </Link>
                <Link
                  href={report.historyHref}
                  className="to-btn inline-flex rounded-md border px-3 py-2 text-sm font-medium"
                  style={{ borderColor: "var(--to-border)" }}
                >
                  Open History
                </Link>
                {report.progressHref ? (
                  <Link
                    href={report.progressHref}
                    className="to-btn inline-flex rounded-md border px-3 py-2 text-sm font-medium"
                    style={{ borderColor: "var(--to-border)" }}
                  >
                    Open Progress
                  </Link>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </section>
    </PageShell>
  );
}
