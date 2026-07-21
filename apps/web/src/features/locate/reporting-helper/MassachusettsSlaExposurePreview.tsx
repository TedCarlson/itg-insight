"use client";

import { Card } from "@/components/ui/Card";
import type {
  MassachusettsSlaExposureGeneratedReport,
  MassachusettsSlaExposureRow,
} from "@/shared/server/locate/reporting-helper/reportingHelperTypes";

function formatHours(hours: number | null) {
  if (hours == null) return "Timing unavailable";
  if (hours < 0) return `${Math.abs(hours).toFixed(1)} hours late`;
  return `${hours.toFixed(1)} hours remaining`;
}

function riskLabel(value: MassachusettsSlaExposureRow["risk"]) {
  if (value === "OVERDUE") return "Late";
  if (value === "DUE_WITHIN_4_HOURS") return "Due within 4h";
  if (value === "DUE_WITHIN_24_HOURS") return "Due within 24h";
  if (value === "FUTURE") return "Future";
  return "Unknown";
}

function riskBadgeClass(value: MassachusettsSlaExposureRow["risk"]) {
  if (value === "OVERDUE") return "border-red-300 bg-red-50 text-red-800";
  if (value === "DUE_WITHIN_4_HOURS") return "border-orange-300 bg-orange-50 text-orange-900";
  if (value === "DUE_WITHIN_24_HOURS") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-[var(--to-border)] bg-[var(--to-surface-2)] text-[var(--to-ink-muted)]";
}

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function buildFindings(report: MassachusettsSlaExposureGeneratedReport) {
  const summary = report.summary;
  const newLate = summary.newLateTickets ?? summary.overdue;
  const findings: string[] = [];

  findings.push(
    `${countLabel(newLate, "ticket")} ${newLate === 1 ? "is" : "are"} represented at row grain in this report.`,
  );

  const topTech = report.exposure.byTechnician[0];
  if (topTech && newLate > 0) {
    const share = Math.round((topTech.count / newLate) * 100);
    findings.push(`${topTech.label} carries the largest technician concentration with ${topTech.count} ticket${topTech.count === 1 ? "" : "s"} (${share}%).`);
  }

  const topPlace = report.exposure.byPlace[0];
  if (topPlace) {
    findings.push(`${topPlace.label} is the highest-exposure municipality with ${countLabel(topPlace.count, "ticket")}.`);
  }

  if (summary.withoutResponseEvidence > 0) {
    findings.push(`${countLabel(summary.withoutResponseEvidence, "ticket")} ${summary.withoutResponseEvidence === 1 ? "has" : "have"} no response evidence in the source.`);
  }

  if ((summary.previouslyReportedLateTickets ?? 0) > 0) {
    findings.push(`${countLabel(summary.previouslyReportedLateTickets ?? 0, "previously reported ticket")} were suppressed from this new-exposure record.`);
  }

  return findings;
}

function ExposureList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
        {title}
      </div>
      <div className="grid gap-1.5">
        {items.slice(0, 8).map((item, index) => (
          <div
            key={item.label}
            className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--to-border)" }}
          >
            <span className="text-xs text-[var(--to-ink-muted)]">{index + 1}</span>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
        {!items.length ? <div className="text-sm text-[var(--to-ink-muted)]">No exposure in this report.</div> : null}
      </div>
    </div>
  );
}

export function MassachusettsSlaExposurePreview({
  report,
}: {
  report: MassachusettsSlaExposureGeneratedReport;
}) {
  const s = report.summary;
  const savedNewLateReport = s.newLateTickets != null;
  const findings = buildFindings(report);

  const metrics = savedNewLateReport
    ? [
        ["Source overdue", s.sourceOverdueTickets ?? s.overdue],
        ["New late exposure", s.newLateTickets ?? s.overdue],
        ["Previously reported", s.previouslyReportedLateTickets ?? 0],
        ["No response evidence", s.withoutResponseEvidence],
        ["Technicians exposed", report.exposure.byTechnician.length],
      ]
    : [
        ["Unique tickets", s.uniqueTickets],
        ["Overdue", s.overdue],
        ["Due within 4h", s.dueWithin4Hours],
        ["Due within 24h", s.dueWithin24Hours],
        ["No response evidence", s.withoutResponseEvidence],
      ];

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--to-ink-muted)]">
              Massachusetts SLA Exposure
            </div>
            <h2 className="mt-1 text-xl font-semibold">{report.title}</h2>
            <p className="mt-1 text-sm text-[var(--to-ink-muted)]">
              Source as of {report.sourceAsOfLocal} Massachusetts local time.
            </p>
          </div>
          <div className="rounded-md border px-3 py-2 text-right" style={{ borderColor: "var(--to-border)" }}>
            <div className="text-xs text-[var(--to-ink-muted)]">Report date</div>
            <div className="font-semibold">{report.reportDate}</div>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value]) => (
          <Card key={String(label)}>
            <div className="text-xs text-[var(--to-ink-muted)]">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="font-semibold">Management findings</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {findings.map((finding) => (
            <div key={finding} className="rounded-md bg-[var(--to-surface-2)] px-3 py-2 text-sm leading-6">
              {finding}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Exposure intelligence</h3>
        <div className="grid gap-5 lg:grid-cols-3">
          <ExposureList title="Technician" items={report.exposure.byTechnician} />
          <ExposureList title="Municipality" items={report.exposure.byPlace} />
          <ExposureList title="Division" items={report.exposure.byDivision} />
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">New-ticket evidence</h3>
            <p className="mt-1 text-sm text-[var(--to-ink-muted)]">
              Ticket number is the row-grain identity for every exposure event.
            </p>
          </div>
          <div className="text-xs text-[var(--to-ink-muted)]">{countLabel(report.rows.length, "ticket")}</div>
        </div>

        <div className="overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}>
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-[var(--to-surface-2)]">
              <tr className="text-left">
                <th className="px-3 py-2">Ticket number</th>
                <th className="px-3 py-2">Exposure</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Assigned</th>
                <th className="px-3 py-2">Municipality</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Response evidence</th>
                <th className="px-3 py-2">Division / Region</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (
                <tr
                  key={`${row.ticketId}-${index}`}
                  className="border-t bg-[var(--to-surface)]"
                  style={{ borderColor: "var(--to-border)" }}
                >
                  <td className="px-3 py-3 font-mono font-semibold tracking-wide">
                    {row.ticketId}
                    {row.duplicateOccurrenceCount > 1 ? (
                      <span className="ml-2 text-xs font-normal text-[var(--to-ink-muted)]">×{row.duplicateOccurrenceCount}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${riskBadgeClass(row.risk)}`}>
                      {riskLabel(row.risk)}
                    </span>
                    <div className="mt-1 text-xs text-[var(--to-ink-muted)]">{formatHours(row.hoursUntilDue)}</div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.dueTime}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.assignedTo ?? "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.place ?? "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.ticketType ?? row.workType ?? "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {row.hasResponseEvidence ? `${row.lastResponse ?? "Response"} ${row.lastResponseDate ?? ""}`.trim() : "None"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.division ?? "—"} / {row.region ?? "—"}</td>
                </tr>
              ))}
              {!report.rows.length ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--to-ink-muted)]" colSpan={8}>
                    No ticket exposure rows are present in this report.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {report.duplicateTicketIds.length ? (
        <Card>
          <h3 className="font-semibold">Repeated ticket IDs in source</h3>
          <p className="mt-2 text-sm text-[var(--to-ink-muted)]">{report.duplicateTicketIds.join(", ")}</p>
        </Card>
      ) : null}
    </div>
  );
}
