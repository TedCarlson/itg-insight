"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { TicketReceiptAuditPreview } from "./TicketReceiptAuditPreview";
import { MassachusettsSlaExposurePreview } from "./MassachusettsSlaExposurePreview";

import { useSearchParams } from "next/navigation";
type Report = any;
type ReportType = "COTP" | "TICKET_RECEIPT_AUDIT" | "MASSACHUSETTS_SLA_EXPOSURE";

const samplePlaceholders: Record<ReportType, string> = {
  COTP: "Paste raw COTP update here...",
  TICKET_RECEIPT_AUDIT: "Paste the email source here...",
  MASSACHUSETTS_SLA_EXPOSURE: "Paste the tab-delimited Massachusetts Ticket Summary here...",
};

function cotpRowClass(status: string) {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized === "needs attention") {
    return "border-t bg-red-700 text-white";
  }

  if (normalized === "watch closely") {
    return "border-t bg-yellow-300 text-yellow-950";
  }

  return "border-t";
}

function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

function pct(value: unknown) {
  return value == null ? "—" : `${value}%`;
}

function deltaDisplay(value: unknown) {
  if (value == null) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const unit = Math.abs(num) === 1 ? "pt" : "pts";
  if (num > 0) return `▲ +${num} ${unit}`;
  if (num < 0) return `▼ ${num} ${unit}`;
  return "— 0 pts";
}

function timelineLabels(report: Report) {
  const first = report?.rows?.[0];
  const previous = first?.completedWeekPrevious?.weekEnding ?? "Observation 1";
  const current = first?.completedWeekCurrent?.weekEnding ?? "Observation 2";
  const live = first?.liveWeek?.weekEnding ?? report?.weekEnding ?? "Observation 3";

  return {
    previous,
    current,
    live,
    completedDelta: `Δ ${previous}→${current}`,
    liveDelta: `Δ ${current}→${live}`,
  };
}

async function copyRichClipboard(args: { html: string; text: string }) {
  const clipboardItem = typeof ClipboardItem !== "undefined"
    ? new ClipboardItem({
        "text/html": new Blob([args.html], { type: "text/html" }),
        "text/plain": new Blob([args.text], { type: "text/plain" }),
      })
    : null;

  if (clipboardItem && navigator.clipboard?.write) {
    await navigator.clipboard.write([clipboardItem]);
    return;
  }

  await navigator.clipboard.writeText(args.text);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rowStyle(status: string) {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized === "needs attention") {
    return "background:#b91c1c;color:#ffffff;font-weight:600;";
  }

  if (normalized === "watch closely") {
    return "background:#fde047;color:#422006;font-weight:600;";
  }

  return "";
}

function reportTableHtml(report: Report) {
  if (!report?.rows?.length) return "";

  const labels = timelineLabels(report);
  const th =
    "border:1px solid #d1d5db;padding:8px;background:#f8fafc;color:#111827;font-weight:700;text-align:left;";
  const td = "border:1px solid #d1d5db;padding:8px;color:inherit;";
  const num = `${td}text-align:right;`;

  const rows = report.rows
    .map((r: any) => {
      const style = rowStyle(r.status);
      return `<tr style="${style}">
        <td style="${td}font-weight:700;">${escapeHtml(r.state)}</td>
        <td style="${num}">${escapeHtml(pct(r.completedWeekPrevious?.value))}</td>
        <td style="${num}">${escapeHtml(pct(r.completedWeekCurrent?.value))}</td>
        <td style="${num}">${escapeHtml(pct(r.liveWeek?.value))}</td>
        <td style="${num}">${escapeHtml(deltaDisplay(r.completedWeekDelta))}</td>
        <td style="${num}">${escapeHtml(deltaDisplay(r.liveWeekDelta))}</td>
        <td style="${td}font-weight:700;">${escapeHtml(r.status)}</td>
      </tr>`;
    })
    .join("");

  return `<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;">
    <thead>
      <tr>
        <th style="${th}">State</th>
        <th style="${th}text-align:right;">${escapeHtml(labels.previous)}</th>
        <th style="${th}text-align:right;">${escapeHtml(labels.current)}</th>
        <th style="${th}text-align:right;">${escapeHtml(labels.live)}</th>
        <th style="${th}text-align:right;">${escapeHtml(labels.completedDelta)}</th>
        <th style="${th}text-align:right;">${escapeHtml(labels.liveDelta)}</th>
        <th style="${th}">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function keyTakeawaysHtml(report: Report) {
  return Object.entries(report?.keyTakeaways ?? {})
    .filter(([, states]) => Array.isArray(states) && states.length)
    .map(([label, states]) => {
      return `<p><strong>${escapeHtml(label)}:</strong><br>${escapeHtml((states as string[]).join(", "))}</p>`;
    })
    .join("");
}

function fullEmailHtml(report: Report) {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;">
    <p><strong>Subject:</strong> ${escapeHtml(report.emailDraft.subject)}</p>
    <p>${escapeHtml(report.executiveSummary)}</p>
    ${keyTakeawaysHtml(report)}
    ${reportTableHtml(report)}
    <br>
    ${escapeHtml(report.emailDraft.body).replaceAll("\n", "<br>")}
  </div>`;
}

function fullEmailText(report: Report, keyTakeawaysText: string) {
  return [
    `Subject: ${report.emailDraft.subject}`,
    "",
    report.executiveSummary,
    "",
    keyTakeawaysText,
    "",
    tableText(report),
    "",
    report.emailDraft.body,
  ].join("\n");
}

function tableText(report: Report) {
  if (!report?.rows?.length) return "";

  const labels = timelineLabels(report);
  const header = ["State", labels.previous, labels.current, labels.live, labels.completedDelta, labels.liveDelta, "Status"];

  const rows = report.rows.map((r: any) => [
    r.state,
    pct(r.completedWeekPrevious?.value),
    pct(r.completedWeekCurrent?.value),
    pct(r.liveWeek?.value),
    deltaDisplay(r.completedWeekDelta),
    deltaDisplay(r.liveWeekDelta),
    r.status,
  ]);

  return [header, ...rows].map((row) => row.join("\t")).join("\n");
}

export function ReportingHelperClient() {
  const searchParams = useSearchParams();
  const requestedReportType = searchParams.get("reportType");
  const initialReportType: ReportType = requestedReportType === "TICKET_RECEIPT_AUDIT" || requestedReportType === "MASSACHUSETTS_SLA_EXPOSURE" ? requestedReportType : "COTP";

  const [reportType, setReportType] =
    useState<ReportType>(initialReportType);
  const [rawText, setRawText] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requestedType = new URLSearchParams(window.location.search).get("reportType");
    if (requestedType === "COTP" || requestedType === "TICKET_RECEIPT_AUDIT" || requestedType === "MASSACHUSETTS_SLA_EXPOSURE") {
      setReportType(requestedType);
    }
  }, []);

  const keyTakeawaysText = useMemo(() => {
    if (!report?.keyTakeaways) return "";
    return Object.entries(report.keyTakeaways)
      .filter(([, states]) => Array.isArray(states) && states.length)
      .map(([label, states]) => `${label}:\n${(states as string[]).join(", ")}`)
      .join("\n\n");
  }, [report]);

  async function generate() {
    setBusy("generate");
    setError(null);
    setRecordId(null);

    try {
      const res = await fetch("/api/locate/reporting-helper/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report_type: reportType, raw_text: rawText }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Generate failed");
      setReport(json.report);
    } catch (e: any) {
      setError(e?.message ?? "Generate failed");
      setReport(null);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setError(null);

    try {
      const res = await fetch("/api/locate/reporting-helper/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report_type: reportType, raw_text: rawText }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Save failed");
      setReport(json.report);
      setRecordId(json.record_id);
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <div className="grid gap-3">
          <div>
            <h2 className="text-lg font-semibold">Reporting Helper</h2>
            <p className="text-sm text-[var(--to-ink-muted)]">
              Paste messy operational text, generate a leadership-ready report, then save it as a historical record.
            </p>
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-[var(--to-ink-muted)]">Report Type</label>
            <select
              className="to-select max-w-[280px]"
              value={reportType}
              onChange={(event) => {
                setReportType(event.target.value as ReportType);
                setReport(null);
                setRecordId(null);
                setError(null);
              }}
            >
              <option value="COTP">COTP</option>
              <option value="TICKET_RECEIPT_AUDIT">Ticket Receipt Audit</option>
              <option value="MASSACHUSETTS_SLA_EXPOSURE">Massachusetts SLA Exposure</option>
            </select>
          </div>

          <textarea
            className="min-h-[260px] rounded-md border bg-transparent p-3 text-sm"
            style={{ borderColor: "var(--to-border)" }}
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder={samplePlaceholders[reportType]}
          />

          {error ? <div className="text-sm text-[var(--to-danger)]">{error}</div> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="to-btn to-btn--primary rounded-md border px-3 py-2 text-sm font-medium"
              onClick={() => void generate()}
              disabled={!rawText.trim() || busy !== null}
            >
              {busy === "generate" ? "Generating…" : "Generate Report"}
            </button>

            <button
              type="button"
              className="to-btn rounded-md border px-3 py-2 text-sm font-medium"
              style={{ borderColor: "var(--to-border)" }}
              onClick={() => {
                setRawText("");
                setReport(null);
                setRecordId(null);
                setError(null);
              }}
              disabled={busy !== null}
            >
              Clear
            </button>

            <button
              type="button"
              className="to-btn rounded-md border px-3 py-2 text-sm font-medium"
              style={{ borderColor: "var(--to-border)" }}
              onClick={() => void save()}
              disabled={!rawText.trim() || busy !== null}
            >
              {busy === "save" ? "Saving…" : "Save Historical Record"}
            </button>

            {recordId && reportType === "COTP" ? (
              <a
                className="to-btn rounded-md border px-3 py-2 text-sm font-medium"
                style={{ borderColor: "var(--to-border)" }}
                href={`/api/locate/reporting-helper/export/xlsx?record_id=${encodeURIComponent(recordId)}`}
              >
                Export Excel
              </a>
            ) : null}
          </div>

          {recordId ? (
            <div className="text-xs text-[var(--to-ink-muted)]">Saved record: {recordId}</div>
          ) : null}

          {report?.reportName === "COTP" ? (
            <button
              type="button"
              className="to-btn rounded-md border px-3 py-2 text-sm font-medium"
              style={{ borderColor: "var(--to-border)" }}
              onClick={() =>
                void copyRichClipboard({
                  html: fullEmailHtml(report),
                  text: fullEmailText(report, keyTakeawaysText),
                })
              }
            >
              Copy Full Email
            </button>
          ) : null}
        </div>
      </Card>

      {report?.reportName === "COTP" ? (
        <>
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
              <button
                className="to-btn rounded border px-2 py-1 text-xs"
                style={{ borderColor: "var(--to-border)" }}
                onClick={() =>
                  void copyRichClipboard({
                    html: reportTableHtml(report),
                    text: tableText(report),
                  })
                }
              >
                Copy Table
              </button>
            </div>
            <div className="overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}>
              <table className="w-full text-sm">
                <thead className="bg-[var(--to-surface-2)]">
                  <tr className="text-left">
                    <th className="px-3 py-2">State</th>
                    <th className="px-3 py-2 text-right">{timelineLabels(report).previous}</th>
                    <th className="px-3 py-2 text-right">{timelineLabels(report).current}</th>
                    <th className="px-3 py-2 text-right">{timelineLabels(report).live}</th>
                    <th className="px-3 py-2 text-right">{timelineLabels(report).completedDelta}</th>
                    <th className="px-3 py-2 text-right">{timelineLabels(report).liveDelta}</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row: any) => (
                    <tr key={row.state} className={cotpRowClass(row.status)} style={{ borderColor: "var(--to-border)" }}>
                      <td className="px-3 py-2 font-semibold">{row.state}</td>
                      <td className="px-3 py-2 text-right">{pct(row.completedWeekPrevious?.value)}</td>
                      <td className="px-3 py-2 text-right">{pct(row.completedWeekCurrent?.value)}</td>
                      <td className="px-3 py-2 text-right">{pct(row.liveWeek?.value)}</td>
                      <td className="px-3 py-2 text-right">{deltaDisplay(row.completedWeekDelta)}</td>
                      <td className="px-3 py-2 text-right">{deltaDisplay(row.liveWeekDelta)}</td>
                      <td className="px-3 py-2">{row.status}</td>
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
        </>
      ) : null}

      {report?.reportName === "TICKET_RECEIPT_AUDIT" ? (
        <TicketReceiptAuditPreview report={report} />
      ) : null}
      {report?.reportName === "MASSACHUSETTS_SLA_EXPOSURE" ? (
        <MassachusettsSlaExposurePreview report={report} />
      ) : null}
    </div>
  );
}
