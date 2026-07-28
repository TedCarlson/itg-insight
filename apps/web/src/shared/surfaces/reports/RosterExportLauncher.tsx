// path: apps/web/src/shared/surfaces/reports/RosterExportLauncher.tsx

"use client";

import type { WorkforceRow } from "@/shared/types/workforce/workforce.types";

type Props = {
  rows: WorkforceRow[];
  regionLabel: string;
  reportMonthLabel: string;
};

type ExportRow = WorkforceRow & Record<string, unknown>;

const COLUMNS = ["Location", "Workgroup", "Company", "Tech #", "First Name", "Last Name", "Position", "Status", "EPON", "BPID", "Notes"] as const;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function pick(row: ExportRow, keys: string[]) {
  for (const key of keys) {
    const value = clean(row[key]);
    if (value) return value;
  }

  return "";
}

function csvCell(value: unknown) {
  const text = clean(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function fileSafe(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function buildCsv(rows: WorkforceRow[]) {
  const exportRows = [...rows]
    .filter((row) => row.is_active)
    .sort((a, b) =>
      clean(a.display_name || a.full_name || a.legal_name).localeCompare(
        clean(b.display_name || b.full_name || b.legal_name),
        undefined,
        { sensitivity: "base" }
      )
    )
    .map((row) => {
      const record = row as ExportRow;

      return [
        clean(row.office),
        "",
        clean(row.affiliation),
        clean(row.tech_id),
        clean(row.display_name || row.full_name || row.legal_name),
        "",
        clean(row.position_title),
        clean(row.seat_type),
        pick(record, ["epon", "EPON", "person_epon", "personEpon"]),
        pick(record, ["nt_login", "ntLogin", "person_nt_login", "personNtLogin"]),
        "",
      ];
    });

  return [
    COLUMNS.map(csvCell).join(","),
    ...exportRows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}

export function RosterExportLauncher({ rows, regionLabel, reportMonthLabel }: Props) {
  function downloadCsv() {
    const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `Roster Export - ${fileSafe(regionLabel)} - ${fileSafe(reportMonthLabel)}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={downloadCsv}
      className="rounded-xl border px-4 py-2 text-sm"
      title="Export active roster with location, company, tech number, name, position, status, EPON, BPID, and notes."
    >
      Roster Export
    </button>
  );
}
