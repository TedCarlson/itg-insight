"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { CotpGeneratedReport } from "@/shared/server/locate/reporting-helper/reportingHelperTypes";

function pct(value: unknown) { return value == null ? "—" : `${value}%`; }
function deltaDisplay(value: unknown) {
  if (value == null) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const unit = Math.abs(num) === 1 ? "pt" : "pts";
  if (num > 0) return `▲ +${num} ${unit}`;
  if (num < 0) return `▼ ${num} ${unit}`;
  return "— 0 pts";
}
function timelineLabels(report: CotpGeneratedReport) {
  const first = report.rows?.[0];
  const previous = first?.completedWeekPrevious?.weekEnding ?? "Observation 1";
  const current = first?.completedWeekCurrent?.weekEnding ?? "Observation 2";
  const live = first?.liveWeek?.weekEnding ?? report.weekEnding ?? "Observation 3";
  return { previous, current, live, completedDelta: `Δ ${previous}→${current}`, liveDelta: `Δ ${current}→${live}` };
}
function cotpRowClass(status: string) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "needs attention") return "border-t bg-red-50 text-red-950";
  if (normalized === "watch closely") return "border-t bg-yellow-50 text-yellow-950";
  if (["recovery trending", "improving trend", "strong", "excellent"].includes(normalized)) return "border-t bg-green-50 text-green-950";
  return "border-t";
}

export function CotpReportDetail({ recordId, record, report, onDelete }: { recordId: string; record: any; report: CotpGeneratedReport; onDelete: () => void }) {
  const labels = timelineLabels(report);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Saved COTP Report</h2><p className="text-sm text-[var(--to-ink-muted)]">Week ending {report.weekEnding ?? record?.week_ending_date ?? "—"} • Record {recordId}</p></div>
        <div className="flex flex-wrap gap-2">
          <Link href="/locate/reporting-helper/history/cotp" className="to-btn rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--to-border)" }}>Back to History</Link>
          <a href={`/api/locate/reporting-helper/export/xlsx?record_id=${encodeURIComponent(recordId)}`} className="to-btn rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--to-border)" }}>Export Excel</a>
          <button type="button" className="to-btn rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--to-danger)", color: "var(--to-danger)" }} onClick={onDelete}>Delete Report</button>
        </div>
      </div>
      <Card><h3 className="mb-2 font-semibold">Executive Summary</h3><p className="text-sm leading-6">{report.executiveSummary}</p></Card>
      <Card>
        <h3 className="mb-2 font-semibold">Key Takeaways</h3>
        <div className="grid gap-3 md:grid-cols-2">{Object.entries(report.keyTakeaways ?? {}).map(([label, states]) => <div key={label} className="rounded border p-3" style={{ borderColor: "var(--to-border)" }}><div className="text-sm font-semibold">{label}</div><div className="mt-1 text-sm text-[var(--to-ink-muted)]">{states.length ? states.join(", ") : "—"}</div></div>)}</div>
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">State-Level Detail</h3>
        <div className="overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}><table className="w-full text-sm"><thead className="bg-[var(--to-surface-2)]"><tr className="text-left"><th className="px-3 py-2">State</th><th className="px-3 py-2 text-right">{labels.previous}</th><th className="px-3 py-2 text-right">{labels.current}</th><th className="px-3 py-2 text-right">{labels.live}</th><th className="px-3 py-2 text-right">{labels.completedDelta}</th><th className="px-3 py-2 text-right">{labels.liveDelta}</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.state} className={cotpRowClass(row.status)} style={{ borderColor: "var(--to-border)" }}><td className="px-3 py-2 font-semibold">{row.state}</td><td className="px-3 py-2 text-right">{pct(row.completedWeekPrevious.value)}</td><td className="px-3 py-2 text-right">{pct(row.completedWeekCurrent.value)}</td><td className="px-3 py-2 text-right">{pct(row.liveWeek.value)}</td><td className="px-3 py-2 text-right">{deltaDisplay(row.completedWeekDelta)}</td><td className="px-3 py-2 text-right">{deltaDisplay(row.liveWeekDelta)}</td><td className="px-3 py-2 font-semibold">{row.status}</td></tr>)}</tbody></table></div>
      </Card>
      <Card><h3 className="mb-2 font-semibold">Suggested Email Draft</h3><div className="rounded border p-3 text-sm" style={{ borderColor: "var(--to-border)" }}><div className="font-semibold">Subject: {report.emailDraft.subject}</div><pre className="mt-3 whitespace-pre-wrap font-sans leading-6">{report.emailDraft.body}</pre></div></Card>
    </div>
  );
}
