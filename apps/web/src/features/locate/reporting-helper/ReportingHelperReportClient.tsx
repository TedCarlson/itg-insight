"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

type Report = any;

function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

function cotpRowClass(status: string) {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized === "needs attention") return "border-t bg-red-50 text-red-950";
  if (normalized === "watch closely") return "border-t bg-yellow-50 text-yellow-950";

  if (
    normalized === "recovery trending" ||
    normalized === "improving trend" ||
    normalized === "strong" ||
    normalized === "excellent"
  ) {
    return "border-t bg-green-50 text-green-950";
  }

  return "border-t";
}

function tableText(report: Report) {
  if (!report?.rows?.length) return "";
  const header = ["State", `Week Ending ${report.weekEnding ?? ""}`, "Prior Week", "Change", "Current Week Trend", "Status"];
  const rows = report.rows.map((r: any) => [
    r.state,
    `${r.weekEndingValue}%`,
    `${r.priorWeekValue}%`,
    r.changeDisplay,
    `${r.currentWeekTrend}%`,
    r.status,
  ]);
  return [header, ...rows].map((row) => row.join("\t")).join("\n");
}

export function ReportingHelperReportClient({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [record, setRecord] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const keyTakeawaysText = useMemo(() => {
    if (!report?.keyTakeaways) return "";
    return Object.entries(report.keyTakeaways)
      .filter(([, states]) => Array.isArray(states) && states.length)
      .map(([label, states]) => `${label}:\n${(states as string[]).join(", ")}`)
      .join("\n\n");
  }, [report]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch(`/api/locate/reporting-helper/reports/${encodeURIComponent(recordId)}`);
        const json = await res.json();

        if (!res.ok) throw new Error(json.error ?? "Failed to load report");
        if (cancelled) return;

        setRecord(json.record ?? null);
        setReport(json.report ?? null);
      } catch (error: any) {
        if (!cancelled) setErr(error?.message ?? "Failed to load report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  async function removeRecord() {
    const confirmed = window.confirm(
      "Delete this saved report? This will remove the historical record and its COTP detail rows."
    );

    if (!confirmed) return;

    const res = await fetch(`/api/locate/reporting-helper/reports/${encodeURIComponent(recordId)}`, {
      method: "DELETE",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(json.error ?? "Delete failed");
      return;
    }

    router.push("/locate/reporting-helper/history");
  }

  if (loading) {
    return <Card><div className="text-sm text-[var(--to-ink-muted)]">Loading saved report…</div></Card>;
  }

  if (err || !report) {
    return <Card><div className="text-sm text-[var(--to-danger)]">{err ?? "Report not found"}</div></Card>;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Saved COTP Report</h2>
          <p className="text-sm text-[var(--to-ink-muted)]">
            Week ending {report.weekEnding ?? record?.week_ending_date ?? "—"} • Record {recordId}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/locate/reporting-helper/history"
            className="to-btn rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
          >
            Back to History
          </Link>
          <a
            href={`/api/locate/reporting-helper/export/xlsx?record_id=${encodeURIComponent(recordId)}`}
            className="to-btn rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
          >
            Export Excel
          </a>
          <button
            type="button"
            className="to-btn rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-danger)", color: "var(--to-danger)" }}
            onClick={() => void removeRecord()}
          >
            Delete Report
          </button>
        </div>
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Executive Summary</h3>
          <button className="to-btn rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--to-border)" }} onClick={() => copyText(report.executiveSummary)}>
            Copy
          </button>
        </div>
        <p className="text-sm leading-6">{report.executiveSummary}</p>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Key Takeaways</h3>
          <button className="to-btn rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--to-border)" }} onClick={() => copyText(keyTakeawaysText)}>
            Copy
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(report.keyTakeaways ?? {}).map(([label, states]) => (
            <div key={label} className="rounded border p-3" style={{ borderColor: "var(--to-border)" }}>
              <div className="text-sm font-semibold">{label}</div>
              <div className="mt-1 text-sm text-[var(--to-ink-muted)]">
                {Array.isArray(states) && states.length ? states.join(", ") : "—"}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-semibold">State-Level Detail</h3>
          <button className="to-btn rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--to-border)" }} onClick={() => copyText(tableText(report))}>
            Copy Table
          </button>
        </div>

        <div className="overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}>
          <table className="w-full text-sm">
            <thead className="bg-[var(--to-surface-2)]">
              <tr className="text-left">
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2 text-right">Week Ending {report.weekEnding}</th>
                <th className="px-3 py-2 text-right">Prior Week</th>
                <th className="px-3 py-2 text-right">Change</th>
                <th className="px-3 py-2 text-right">Current Trend</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row: any) => (
                <tr key={row.state} className={cotpRowClass(row.status)} style={{ borderColor: "var(--to-border)" }}>
                  <td className="px-3 py-2 font-semibold">{row.state}</td>
                  <td className="px-3 py-2 text-right">{row.weekEndingValue}%</td>
                  <td className="px-3 py-2 text-right">{row.priorWeekValue}%</td>
                  <td className="px-3 py-2 text-right">{row.changeDisplay}</td>
                  <td className="px-3 py-2 text-right">{row.currentWeekTrend}%</td>
                  <td className="px-3 py-2 font-semibold">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Suggested Email Draft</h3>
          <button className="to-btn rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--to-border)" }} onClick={() => copyText(`Subject: ${report.emailDraft.subject}\n\n${report.emailDraft.body}`)}>
            Copy Email
          </button>
        </div>
        <div className="rounded border p-3 text-sm" style={{ borderColor: "var(--to-border)" }}>
          <div className="font-semibold">Subject: {report.emailDraft.subject}</div>
          <pre className="mt-3 whitespace-pre-wrap font-sans leading-6">{report.emailDraft.body}</pre>
        </div>
      </Card>
    </div>
  );
}
