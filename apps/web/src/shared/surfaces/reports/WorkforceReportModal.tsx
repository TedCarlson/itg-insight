// path: apps/web/src/shared/surfaces/reports/WorkforceReportModal.tsx

"use client";

import { useMemo, useRef } from "react";
import type { WorkforceRow } from "@/shared/types/workforce/workforce.types";

type Props = {
  open: boolean;
  rows: WorkforceRow[];
  onClose: () => void;
  regionLabel: string;
  reportMonthLabel: string;
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function isUnassignedSupervisor(row: WorkforceRow) {
  const reportsTo = String(row.reports_to_name ?? "").trim();
  return !reportsTo || reportsTo.toLowerCase() === "unassigned";
}

function isLeadershipAboveManager(row: WorkforceRow) {
  const title = String(row.position_title ?? "").trim().toLowerCase();

  return (
    row.seat_type === "LEADERSHIP" &&
    (title === "director" ||
      title === "regional director" ||
      title === "senior director" ||
      title === "vp" ||
      title === "vice president")
  );
}

function shouldIncludeReportRow(row: WorkforceRow) {
  return !(isUnassignedSupervisor(row) && isLeadershipAboveManager(row));
}

function displayTechId(row: WorkforceRow) {
  const techId = String(row.tech_id ?? "").trim();

  if (!techId) return row.position_title ?? "—";
  if (techId.startsWith("UNASSIGNED-")) return row.position_title ?? "—";

  return techId;
}

function displayAffiliate(row: WorkforceRow) {
  return row.affiliation ?? "Unassigned Affiliate";
}

function countSeat(rows: WorkforceRow[], seatType: string) {
  return rows.filter((row) => row.seat_type === seatType).length;
}

function buildCsv(rows: WorkforceRow[]) {
  const reportRows = rows.filter(shouldIncludeReportRow);

  const output = [
    ["Affiliate", "Person", "Tech ID", "Role", "Seat", "Reports To"],
    ...reportRows.map((row) => [
      displayAffiliate(row),
      row.display_name ?? "—",
      displayTechId(row),
      row.position_title ?? "—",
      row.seat_type ?? "—",
      row.reports_to_name ?? "Unassigned",
    ]),
  ];

  return output.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function WorkforceReportModal({
  open,
  rows,
  onClose,
  regionLabel,
  reportMonthLabel,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const reportRows = useMemo(
    () => rows.filter(shouldIncludeReportRow),
    [rows]
  );

  const grouped = useMemo(() => {
    const affiliateMap = new Map<string, WorkforceRow[]>();

    for (const row of reportRows) {
      const affiliate = displayAffiliate(row);

      if (!affiliateMap.has(affiliate)) {
        affiliateMap.set(affiliate, []);
      }

      affiliateMap.get(affiliate)!.push(row);
    }

    return Array.from(affiliateMap.entries())
      .map(([affiliate, team]) => ({
        affiliate,
        totalCount: team.length,
        team: team.sort((a, b) => {
          const roleRank = (row: WorkforceRow) => {
            switch (row.seat_type) {
              case "LEADERSHIP":
                return 0;
              case "TRAINING":
                return 1;
              case "FIELD":
                return 2;
              case "TRAVEL":
                return 3;
              case "DROP_BURY":
                return 4;
              case "FMLA":
                return 5;
              default:
                return 9;
            }
          };

          const seatDiff = roleRank(a) - roleRank(b);
          if (seatDiff !== 0) return seatDiff;

          return String(a.display_name ?? "").localeCompare(
            String(b.display_name ?? "")
          );
        }),
      }))
      .sort((a, b) => a.affiliate.localeCompare(b.affiliate));
  }, [reportRows]);

  if (!open) return null;

  function downloadCsv() {
    const blob = new Blob([buildCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `Workforce Report - ${regionLabel} - ${reportMonthLabel}.csv`;
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
          <title>Workforce Report - ${regionLabel} - ${reportMonthLabel}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #111827;
            }

            h1 {
              font-size: 20px;
              margin: 0 0 4px;
            }

            .subhead {
              font-size: 12px;
              color: #4b5563;
              margin-bottom: 6px;
            }

            .report-note {
              font-size: 11px;
              color: #6b7280;
              margin-bottom: 20px;
            }

            h2 {
              font-size: 16px;
              margin: 0 0 12px;
              page-break-after: avoid;
            }

            .group {
              break-inside: avoid;
              page-break-inside: avoid;
              margin-bottom: 28px;
            }

            .summary {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin: 0 0 14px;
            }

            .summary span {
              border: 1px solid #d1d5db;
              border-radius: 999px;
              padding: 4px 8px;
              font-size: 11px;
              color: #4b5563;
            }

            table {
              border-collapse: collapse;
              width: 100%;
              table-layout: fixed;
              margin-bottom: 14px;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            th,
            td {
              border: 1px solid #d1d5db;
              padding: 6px 8px;
              font-size: 11px;
              text-align: left;
              vertical-align: top;
              overflow-wrap: anywhere;
            }

            th {
              background: #f3f4f6;
            }

            th:nth-child(1),
            td:nth-child(1) {
              width: 28%;
            }

            th:nth-child(2),
            td:nth-child(2) {
              width: 14%;
            }

            th:nth-child(3),
            td:nth-child(3) {
              width: 24%;
            }

            th:nth-child(4),
            td:nth-child(4) {
              width: 14%;
            }

            th:nth-child(5),
            td:nth-child(5) {
              width: 20%;
            }
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
            <h2 className="text-lg font-semibold">Workforce Report</h2>
            <div className="text-sm text-muted-foreground">
              {regionLabel} • {reportMonthLabel}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={downloadCsv}
              className="rounded-lg border px-3 py-1.5 text-sm"
            >
              CSV
            </button>

            <button
              onClick={printPdf}
              className="rounded-lg border px-3 py-1.5 text-sm"
            >
              Print / PDF
            </button>

            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-1.5 text-sm"
            >
              Close
            </button>
          </div>
        </div>

        <div ref={printRef} className="flex-1 overflow-y-auto px-5 py-4">
          <h1>{regionLabel} Workforce Report</h1>
          <div className="subhead">{reportMonthLabel}</div>
          <div className="report-note">
            * Reports to a person not listed in the same affiliate group.
          </div>

          {reportRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No workforce data found.
            </div>
          ) : (
            grouped.map((affiliateGroup) => {
              const memberNames = new Set(
                affiliateGroup.team
                  .map((member) => member.display_name)
                  .filter(Boolean)
              );

              const fieldCount = countSeat(affiliateGroup.team, "FIELD");
              const travelCount = countSeat(affiliateGroup.team, "TRAVEL");
              const dropBuryCount = countSeat(affiliateGroup.team, "DROP_BURY");

              return (
                <div
                  key={affiliateGroup.affiliate}
                  className="group mb-10 rounded-2xl border border-[var(--to-border)] bg-[var(--to-surface)] p-4"
                >
                  <h2 className="mb-3 text-lg font-semibold">
                    {affiliateGroup.affiliate} ({affiliateGroup.totalCount})
                  </h2>

                  <div className="summary mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border px-2 py-1">
                      HC {affiliateGroup.totalCount}
                    </span>

                    <span className="rounded-full border px-2 py-1">
                      {fieldCount} Field
                    </span>

                    <span className="rounded-full border px-2 py-1">
                      {travelCount} Travel
                    </span>

                    {dropBuryCount > 0 ? (
                      <span className="rounded-full border px-2 py-1">
                        {dropBuryCount} Drop Bury
                      </span>
                    ) : null}
                  </div>

                  <table className="w-full table-fixed border-collapse text-sm">
                    <colgroup>
                      <col style={{ width: "28%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "24%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "20%" }} />
                    </colgroup>

                    <thead>
                      <tr>
                        <th className="border px-2 py-1 text-left">Person</th>
                        <th className="border px-2 py-1 text-left">Tech ID</th>
                        <th className="border px-2 py-1 text-left">Role</th>
                        <th className="border px-2 py-1 text-left">Seat</th>
                        <th className="border px-2 py-1 text-left">
                          Reports To
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {affiliateGroup.team.map((row) => {
                        const reportsTo = row.reports_to_name ?? "Unassigned";
                        const oversight =
                          reportsTo !== "Unassigned" &&
                            reportsTo !== row.display_name &&
                            !memberNames.has(reportsTo)
                            ? "*"
                            : "";

                        return (
                          <tr key={`${row.assignment_id}:${row.person_id}`}>
                            <td className="border px-2 py-1 truncate">
                              {row.display_name ?? "—"}
                            </td>

                            <td className="border px-2 py-1">
                              {displayTechId(row)}
                            </td>

                            <td className="border px-2 py-1">
                              {row.position_title ?? "—"}
                            </td>

                            <td className="border px-2 py-1">
                              {row.seat_type ?? "—"}
                            </td>

                            <td className="border px-2 py-1">
                              {reportsTo}
                              {oversight ? " *" : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}