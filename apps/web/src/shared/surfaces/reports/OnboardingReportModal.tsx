// path: apps/web/src/shared/surfaces/reports/OnboardingReportModal.tsx

"use client";

import { useMemo, useRef } from "react";

export type OnboardingReportRow = {
  person_id: string;
  full_name: string | null;
  status: string;
  tech_id: string | null;
  mobile: string | null;
  email: string | null;
  nt_login: string | null;
  csg: string | null;
  prospecting_affiliation_id: string | null;
  affiliation_code: string | null;
  affiliation: string | null;
  active_assignment_count: number;
  active_orgs: string | null;
  created_at?: string | null;
  onboarding_date?: string | null;
  days_in_pipeline?: number | null;
};

type Props = {
  open: boolean;
  rows: OnboardingReportRow[];
  onClose: () => void;
  regionLabel: string;
  reportMonthLabel: string;
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function displayDate(row: OnboardingReportRow) {
  return formatDate(row.onboarding_date ?? row.created_at);
}

function buildCsv(rows: OnboardingReportRow[]) {
  const output = [
    ["Person", "Tech ID", "Date Added", "Days in Pipeline"],
    ...rows.map((row) => [
      row.full_name ?? "—",
      row.tech_id ?? "—",
      displayDate(row),
      row.days_in_pipeline ?? "—",
    ]),
  ];

  return output.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function OnboardingReportModal({
  open,
  rows,
  onClose,
  regionLabel,
  reportMonthLabel,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const onboardingRows = useMemo(() => {
    return rows.filter((row) => row.status === "onboarding");
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, OnboardingReportRow[]>();

    for (const row of onboardingRows) {
      const key = row.affiliation ?? "Unassigned Affiliation";

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }

    return Array.from(map.entries())
      .map(([affiliation, group]) => [
        affiliation,
        group.sort((a, b) =>
          String(a.full_name ?? "").localeCompare(String(b.full_name ?? ""))
        ),
      ] as [string, OnboardingReportRow[]])
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [onboardingRows]);

  if (!open) return null;

  function downloadCsv() {
    const blob = new Blob([buildCsv(onboardingRows)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `Onboarding Report - ${regionLabel} - ${reportMonthLabel}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  function printPdf() {
    const html = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Onboarding Report - ${regionLabel} - ${reportMonthLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            .subhead { font-size: 12px; color: #4b5563; margin-bottom: 20px; }

            h2 { font-size: 14px; margin: 18px 0 6px; }

            .group {
              break-inside: avoid;
              page-break-inside: avoid;
              margin-bottom: 16px;
            }

            table {
              border-collapse: collapse;
              width: 100%;
              table-layout: fixed;
              margin-bottom: 12px;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            th, td {
              border: 1px solid #d1d5db;
              padding: 6px 8px;
              font-size: 11px;
              text-align: left;
              vertical-align: top;
              overflow-wrap: anywhere;
            }

            th { background: #f3f4f6; }

            th:nth-child(1), td:nth-child(1) { width: 44%; }
            th:nth-child(2), td:nth-child(2) { width: 16%; }
            th:nth-child(3), td:nth-child(3) { width: 20%; }
            th:nth-child(4), td:nth-child(4) { width: 20%; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);

    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex h-[85vh] w-[95vw] max-w-6xl flex-col rounded-2xl border bg-background shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Onboarding Report</h2>
            <div className="text-sm text-muted-foreground">
              {regionLabel} • {reportMonthLabel} • {onboardingRows.length} onboarding
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={downloadCsv} className="rounded-lg border px-3 py-1.5 text-sm">
              CSV
            </button>
            <button onClick={printPdf} className="rounded-lg border px-3 py-1.5 text-sm">
              Print / PDF
            </button>
            <button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm">
              Close
            </button>
          </div>
        </div>

        <div ref={printRef} className="flex-1 overflow-y-auto px-5 py-4">
          <h1>{regionLabel} Onboarding Report</h1>
          <div className="subhead">{reportMonthLabel}</div>

          {onboardingRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No onboarding records found.
            </div>
          ) : (
            grouped.map(([affiliation, team]) => (
              <div key={affiliation} className="group">
                <h2>
                  {affiliation} ({team.length})
                </h2>

                <table className="w-full table-fixed border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1 text-left">Person</th>
                      <th className="border px-2 py-1 text-left">Tech ID</th>
                      <th className="border px-2 py-1 text-left">Date Added</th>
                      <th className="border px-2 py-1 text-left">Days in Pipeline</th>
                    </tr>
                  </thead>

                  <tbody>
                    {team.map((row) => (
                      <tr key={row.person_id}>
                        <td className="border px-2 py-1">{row.full_name ?? "—"}</td>
                        <td className="border px-2 py-1">{row.tech_id ?? "—"}</td>
                        <td className="border px-2 py-1">{displayDate(row)}</td>
                        <td className="border px-2 py-1">
                          {row.days_in_pipeline ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}