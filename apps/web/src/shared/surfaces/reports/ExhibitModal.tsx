// path: apps/web/src/shared/surfaces/reports/ExhibitModal.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";
import type {
  ExhibitFiscalMonth,
  ExhibitPayload,
  ExhibitTechRow,
} from "@/shared/types/reports/exhibit.types";

type Props = {
  open: boolean;
  affiliations: WorkforceAffiliationOption[];
  regionLabel: string;
  onClose: () => void;
};

type ExhibitType = "FULFILLMENT" | "MDU / DROP";
type WorkerClass = "W2" | "1099";

type ExhibitLine = {
  type: ExhibitType;
  workerClass: WorkerClass;
  area: string;
  w2: number;
  contractor: number;
};

type EntityGroup = {
  entity: string;
  techs: ExhibitTechRow[];
  daysWorked: number;
};

const ITG_LABEL = "Integrated Tech Group";
const NOT_IN_PEOPLE = "Not in People";

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function entityLabel(row: ExhibitTechRow) {
  return normalize(row.entity) || NOT_IN_PEOPLE;
}

function isMduDrop(row: ExhibitTechRow) {
  if (normalize(row.role_type).toUpperCase() === "DROP_BURY") return true;

  const text = `${row.position_title ?? ""} ${row.entity ?? ""}`.toLowerCase();
  return text.includes("mdu") || text.includes("drop");
}

function getAffiliationMeta(
  row: ExhibitTechRow,
  affiliations: WorkforceAffiliationOption[]
) {
  const label = normalize(row.entity);
  if (!label) return undefined;

  const labelUpper = label.toUpperCase();

  return affiliations.find((option) => {
    const optionLabel = normalize(option.affiliation_label);
    const optionCode = normalize(option.affiliation_code);

    return optionLabel === label || optionCode.toUpperCase() === labelUpper;
  });
}

function getWorkerClass(
  row: ExhibitTechRow,
  affiliations: WorkforceAffiliationOption[]
): WorkerClass {
  const meta = getAffiliationMeta(row, affiliations);
  const label = entityLabel(row).toLowerCase();

  if (meta?.affiliation_type === "COMPANY") return "W2";
  if (label.includes("integrated tech group") || label === "itg") return "W2";

  return "1099";
}

function compareEntity(a: string, b: string) {
  if (a === b) return 0;
  if (a === ITG_LABEL) return -1;
  if (b === ITG_LABEL) return 1;
  if (a === NOT_IN_PEOPLE) return 1;
  if (b === NOT_IN_PEOPLE) return -1;
  return a.localeCompare(b);
}

function buildExhibitRows(
  techs: ExhibitTechRow[],
  affiliations: WorkforceAffiliationOption[]
): ExhibitLine[] {
  const map = new Map<string, ExhibitLine>();

  for (const row of techs) {
    const type: ExhibitType = isMduDrop(row) ? "MDU / DROP" : "FULFILLMENT";
    const workerClass = getWorkerClass(row, affiliations);
    const area = entityLabel(row);
    const key = `${type}::${workerClass}::${area}`;

    const existing =
      map.get(key) ??
      ({
        type,
        workerClass,
        area,
        w2: 0,
        contractor: 0,
      } satisfies ExhibitLine);

    if (workerClass === "W2") {
      existing.w2 += 1;
    } else {
      existing.contractor += 1;
    }

    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.workerClass !== b.workerClass) return a.workerClass === "W2" ? -1 : 1;
    return compareEntity(a.area, b.area);
  });
}

function buildEntityGroups(techs: ExhibitTechRow[]): EntityGroup[] {
  const map = new Map<string, ExhibitTechRow[]>();

  for (const row of techs) {
    const entity = entityLabel(row);
    const list = map.get(entity) ?? [];
    list.push(row);
    map.set(entity, list);
  }

  return Array.from(map.entries())
    .map(([entity, rows]) => ({
      entity,
      techs: [...rows].sort((a, b) =>
        normalize(a.full_name || a.tech_id).localeCompare(
          normalize(b.full_name || b.tech_id)
        )
      ),
      daysWorked: rows.reduce((sum, row) => sum + row.days_worked, 0),
    }))
    .sort((a, b) => compareEntity(a.entity, b.entity));
}

function csvEscape(value: string | number) {
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function displayCount(value: number) {
  return value === 0 ? "" : String(value);
}

function fiscalWindowLabel(month: ExhibitFiscalMonth) {
  return `${month.start_date} – ${month.end_date}`;
}

function buildCsv(
  lines: ExhibitLine[],
  groups: EntityGroup[],
  regionLabel: string,
  month: ExhibitFiscalMonth
) {
  const rows: (string | number)[][] = [
    [regionLabel],
    [month.label, fiscalWindowLabel(month)],
    ["Type", "Area", "W2", "1099", "Total"],
    ...lines.map((line) => [
      line.type,
      line.area,
      displayCount(line.w2),
      displayCount(line.contractor),
      displayCount(line.w2 + line.contractor),
    ]),
    [],
    ["Entity", "Tech ID", "Name", "Days Worked", "First Worked", "Last Worked"],
    ...groups.flatMap((group) =>
      group.techs.map((row) => [
        group.entity,
        row.tech_id,
        normalize(row.full_name),
        row.days_worked,
        row.first_worked,
        row.last_worked,
      ])
    ),
  ];

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function total(lines: ExhibitLine[], type?: ExhibitType) {
  return lines
    .filter((line) => !type || line.type === type)
    .reduce(
      (acc, line) => ({
        w2: acc.w2 + line.w2,
        contractor: acc.contractor + line.contractor,
      }),
      { w2: 0, contractor: 0 }
    );
}

export default function ExhibitModal({
  open,
  affiliations,
  regionLabel,
  onClose,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [fiscalMonthId, setFiscalMonthId] = useState<string | null>(null);
  const [payload, setPayload] = useState<ExhibitPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (fiscalMonthId) params.set("fiscal_month_id", fiscalMonthId);

        const res = await fetch(
          `/api/reports/exhibit${params.toString() ? `?${params.toString()}` : ""}`,
          { cache: "no-store" }
        );

        const json = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok) {
          setError(json?.error ?? "Unable to load exhibit");
          return;
        }

        setPayload(json as ExhibitPayload);
      } catch {
        if (!cancelled) setError("Unable to load exhibit");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [open, fiscalMonthId]);

  const techs = useMemo(() => payload?.techs ?? [], [payload]);

  const exhibitRows = useMemo(
    () => buildExhibitRows(techs, affiliations),
    [techs, affiliations]
  );

  const entityGroups = useMemo(() => buildEntityGroups(techs), [techs]);

  const fulfillmentTotal = total(exhibitRows, "FULFILLMENT");
  const mduTotal = total(exhibitRows, "MDU / DROP");
  const regionTotal = total(exhibitRows);

  if (!open) return null;

  const fiscalMonth = payload?.fiscalMonth ?? null;
  const reportMonthLabel = fiscalMonth?.label ?? "";
  const canExport = Boolean(fiscalMonth) && !loading;

  function downloadCsv() {
    if (!fiscalMonth) return;

    const blob = new Blob(
      [buildCsv(exhibitRows, entityGroups, regionLabel, fiscalMonth)],
      { type: "text/csv;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `Exhibit - ${regionLabel} - ${reportMonthLabel}.csv`;
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
          <title>Exhibit - ${regionLabel} - ${reportMonthLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
            th, td { border: 1px solid #444; padding: 6px 8px; font-size: 12px; }
            th { background: #eee; }
            .total { font-weight: bold; }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border bg-background p-5 shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Workforce Report
            </div>
            <h2 className="mt-1 text-lg font-semibold">Exhibit</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              {regionLabel}
              {fiscalMonth
                ? ` • ${fiscalMonth.label} (${fiscalWindowLabel(fiscalMonth)}) • ${techs.length} techs with activity`
                : ""}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={fiscalMonth?.fiscal_month_id ?? ""}
              onChange={(event) => setFiscalMonthId(event.target.value || null)}
              disabled={!payload || loading}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm"
              aria-label="Fiscal month"
            >
              {(payload?.fiscalMonths ?? []).map((month) => (
                <option key={month.fiscal_month_id} value={month.fiscal_month_id}>
                  {month.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={downloadCsv}
              disabled={!canExport}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              CSV
            </button>

            <button
              type="button"
              onClick={printPdf}
              disabled={!canExport}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-3 py-1.5 text-sm"
            >
              Close
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {loading && !payload ? (
          <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
        ) : null}

        <div
          ref={printRef}
          className={["mt-4 overflow-auto", loading ? "opacity-60" : ""].join(" ")}
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border px-3 py-2 text-left" colSpan={5}>
                  {regionLabel}
                  {fiscalMonth
                    ? ` — ${fiscalMonth.label} (${fiscalWindowLabel(fiscalMonth)})`
                    : ""}
                </th>
              </tr>
              <tr>
                <th className="border px-3 py-2 text-left">Type</th>
                <th className="border px-3 py-2 text-left">Area</th>
                <th className="border px-3 py-2 text-right">W2</th>
                <th className="border px-3 py-2 text-right">1099</th>
                <th className="border px-3 py-2 text-right">Total</th>
              </tr>
            </thead>

            <tbody>
              {exhibitRows.map((row, index) => {
                const previous = exhibitRows[index - 1];
                const showType = !previous || previous.type !== row.type;

                return (
                  <tr key={`${row.type}-${row.workerClass}-${row.area}`}>
                    <td className="border px-3 py-2">
                      {showType ? row.type : ""}
                    </td>
                    <td className="border px-3 py-2 font-medium">{row.area}</td>
                    <td className="border px-3 py-2 text-right">
                      {displayCount(row.w2)}
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {displayCount(row.contractor)}
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {displayCount(row.w2 + row.contractor)}
                    </td>
                  </tr>
                );
              })}

              <tr className="font-semibold">
                <td className="border px-3 py-2" colSpan={2}>
                  Fulfillment Total
                </td>
                <td className="border px-3 py-2 text-right">
                  {displayCount(fulfillmentTotal.w2)}
                </td>
                <td className="border px-3 py-2 text-right">
                  {displayCount(fulfillmentTotal.contractor)}
                </td>
                <td className="border px-3 py-2 text-right">
                  {displayCount(fulfillmentTotal.w2 + fulfillmentTotal.contractor)}
                </td>
              </tr>

              <tr className="font-semibold">
                <td className="border px-3 py-2" colSpan={2}>
                  MDU / DROP
                </td>
                <td className="border px-3 py-2 text-right">
                  {displayCount(mduTotal.w2)}
                </td>
                <td className="border px-3 py-2 text-right">
                  {displayCount(mduTotal.contractor)}
                </td>
                <td className="border px-3 py-2 text-right">
                  {displayCount(mduTotal.w2 + mduTotal.contractor)}
                </td>
              </tr>

              <tr className="font-semibold">
                <td className="border px-3 py-2" colSpan={2}>
                  {regionLabel} Total
                </td>
                <td className="border px-3 py-2 text-right">
                  {displayCount(regionTotal.w2)}
                </td>
                <td className="border px-3 py-2 text-right">
                  {displayCount(regionTotal.contractor)}
                </td>
                <td className="border px-3 py-2 text-right">
                  {displayCount(regionTotal.w2 + regionTotal.contractor)}
                </td>
              </tr>
            </tbody>
          </table>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border px-3 py-2 text-left" colSpan={3}>
                  Techs with activity by entity
                </th>
              </tr>
              <tr>
                <th className="border px-3 py-2 text-left">Tech ID</th>
                <th className="border px-3 py-2 text-left">Name</th>
                <th className="border px-3 py-2 text-right">Days Worked</th>
              </tr>
            </thead>

            <tbody>
              {entityGroups.map((group) => [
                <tr key={`${group.entity}-header`} className="font-semibold">
                  <td className="border px-3 py-2" colSpan={2}>
                    {group.entity} ({group.techs.length})
                  </td>
                  <td className="border px-3 py-2 text-right">{group.daysWorked}</td>
                </tr>,
                ...group.techs.map((row) => (
                  <tr key={`${group.entity}-${row.tech_id}`}>
                    <td className="border px-3 py-2">{row.tech_id}</td>
                    <td className="border px-3 py-2">{normalize(row.full_name)}</td>
                    <td className="border px-3 py-2 text-right">{row.days_worked}</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
